import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSpan } from "../_shared/tracer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-trace-id, x-parent-span-id",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  let rootSpan: Awaited<ReturnType<typeof startSpan>> | null = null;

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const { action } = body;
    rootSpan = await startSpan(req, `squad-orchestrator:${action}`, { userId: user.id, input: body });

    // ── START RUN ──
    if (action === "start_run") {
      const { template_id, input_params } = body;
      
      const { data: template } = await sb.from("squad_templates").select("*").eq("id", template_id).single();
      if (!template) throw new Error("Template not found");

      const steps = template.pipeline_steps as any[];
      const agents = template.agents as any[];

      // Create run
      const { data: run, error: runErr } = await sb.from("squad_runs").insert({
        user_id: user.id,
        template_id,
        squad_name: template.name,
        status: "running",
        current_step: 0,
        total_steps: steps.length,
        input_params: input_params || {},
        started_at: new Date().toISOString(),
      }).select().single();
      if (runErr) throw runErr;

      // Create all steps
      const stepRows = steps.map((s: any) => {
        const agent = agents.find((a: any) => a.name === s.agent_name);
        return {
          run_id: run.id,
          step_index: s.step_index,
          agent_name: s.agent_name,
          agent_role: agent?.role || "",
          agent_icon: agent?.icon || "🤖",
          task_description: s.task,
          status: s.step_index === 0 ? "running" : "pending",
          requires_approval: s.checkpoint || false,
          input_data: s.step_index === 0 ? (input_params || {}) : {},
          started_at: s.step_index === 0 ? new Date().toISOString() : null,
        };
      });

      await sb.from("squad_steps").insert(stepRows);

      // Execute first step
      const firstAgent = agents.find((a: any) => a.name === steps[0].agent_name);
      const result = await executeAgentStep(LOVABLE_API_KEY, firstAgent, steps[0], input_params || {}, []);

      // Update first step
      await sb.from("squad_steps").update({
        status: "approved",
        output_data: result,
        completed_at: new Date().toISOString(),
      }).eq("run_id", run.id).eq("step_index", 0);

      // Continue all remaining steps in backend (no checkpoints)
      if (steps.length > 1) {
        await continueRun(sb, LOVABLE_API_KEY, run.id, template, 1, [result]);
      } else {
        await sb.from("squad_runs").update({
          current_step: 0,
          status: "completed",
          results: [result],
          completed_at: new Date().toISOString(),
        }).eq("id", run.id);
      }

      return new Response(JSON.stringify({ success: true, run_id: run.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── APPROVE STEP ──
    if (action === "approve_step") {
      const { run_id, step_index, feedback } = body;

      // Mark step as approved
      await sb.from("squad_steps").update({
        status: "approved",
        user_feedback: feedback || null,
      }).eq("run_id", run_id).eq("step_index", step_index);

      // Get run and template
      const { data: run } = await sb.from("squad_runs").select("*, squad_templates(*)").eq("id", run_id).single();
      if (!run) throw new Error("Run not found");

      const template = run.squad_templates;
      const steps = template.pipeline_steps as any[];
      const nextIndex = step_index + 1;

      if (nextIndex >= steps.length) {
        // All done
        await sb.from("squad_runs").update({
          status: "completed",
          current_step: step_index,
          completed_at: new Date().toISOString(),
        }).eq("id", run_id);
      } else {
        // Continue to next step
        const prevResults = (run.results as any[]) || [];
        await continueRun(sb, LOVABLE_API_KEY, run_id, template, nextIndex, prevResults);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── REJECT STEP ──
    if (action === "reject_step") {
      const { run_id, step_index, feedback } = body;

      // Re-run the step with feedback
      await sb.from("squad_steps").update({
        status: "running",
        user_feedback: feedback || null,
        output_data: {},
        started_at: new Date().toISOString(),
        completed_at: null,
      }).eq("run_id", run_id).eq("step_index", step_index);

      const { data: run } = await sb.from("squad_runs").select("*, squad_templates(*)").eq("id", run_id).single();
      if (!run) throw new Error("Run not found");

      const template = run.squad_templates;
      const steps = template.pipeline_steps as any[];
      const agents = template.agents as any[];
      const agent = agents.find((a: any) => a.name === steps[step_index].agent_name);

      // Get previous results
      const prevResults = ((run.results as any[]) || []).slice(0, step_index);
      
      // Get input for this step
      const input = step_index === 0 ? (run.input_params || {}) : prevResults[step_index - 1] || {};

      const result = await executeAgentStep(
        LOVABLE_API_KEY, agent, steps[step_index], input, prevResults,
        `O usuário pediu revisão com o seguinte feedback: "${feedback}". Refaça a tarefa considerando este feedback.`
      );

      await sb.from("squad_steps").update({
        status: "completed",
        output_data: result,
        completed_at: new Date().toISOString(),
      }).eq("run_id", run_id).eq("step_index", step_index);

      // Update run results
      const newResults = [...prevResults, result];
      await sb.from("squad_runs").update({
        status: "paused",
        results: newResults,
      }).eq("id", run_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("squad-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function continueRun(sb: any, apiKey: string, runId: string, template: any, fromIndex: number, prevResults: any[]) {
  const steps = template.pipeline_steps as any[];
  const agents = template.agents as any[];
  let results = [...prevResults];

  for (let i = fromIndex; i < steps.length; i++) {
    const step = steps[i];
    const agent = agents.find((a: any) => a.name === step.agent_name);

    // Mark step as running
    await sb.from("squad_steps").update({
      status: "running",
      input_data: results.length > 0 ? results[results.length - 1] : {},
      started_at: new Date().toISOString(),
    }).eq("run_id", runId).eq("step_index", i);

    // Execute
    const input = results.length > 0 ? results[results.length - 1] : {};
    const result = await executeAgentStep(apiKey, agent, step, input, results);
    results.push(result);

    // Update step as completed (no checkpoints - runs fully in backend)
    await sb.from("squad_steps").update({
      status: "approved",
      output_data: result,
      completed_at: new Date().toISOString(),
    }).eq("run_id", runId).eq("step_index", i);

    // Update run progress
    await sb.from("squad_runs").update({
      current_step: i,
      results,
      status: "running",
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
  }

  // All steps completed
  await sb.from("squad_runs").update({
    status: "completed",
    results,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
}

async function executeAgentStep(
  apiKey: string, agent: any, step: any, input: any, previousResults: any[], extraInstruction?: string
) {
  const contextFromPrevious = previousResults.length > 0
    ? `\n\nResultados das etapas anteriores:\n${JSON.stringify(previousResults.map((r, i) => ({ etapa: i + 1, resultado: r })), null, 2)}`
    : "";

  const userPrompt = `Tarefa: ${step.task}

Dados de entrada: ${JSON.stringify(input, null, 2)}
${contextFromPrevious}
${extraInstruction || ""}

Responda em português brasileiro. Seja detalhado e prático. Forneça resultados acionáveis.`;

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: agent.system_prompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "Sem resposta do agente";
  
  return {
    agent: agent.name,
    role: agent.role,
    output_type: step.output_type,
    content,
    timestamp: new Date().toISOString(),
  };
}
