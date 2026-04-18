// Meta-Orchestrator — LLM-driven agent that plans + executes a chain of agents
// to accomplish a free-text goal, with shared memory and tracing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { startSpan } from "../_shared/tracer.ts";
import { callEdgeFn } from "../_shared/call-fn.ts";
import { AGENT_REGISTRY, getAgent, registryForPlanner } from "../_shared/agent-registry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface PlanStep {
  step: number;
  agent: string;
  input: Record<string, unknown>;
  reason: string;
  reads_from_memory?: string[]; // memory keys this step depends on
}

async function planWithLLM(goal: string, context: Record<string, unknown>): Promise<PlanStep[]> {
  const systemPrompt = `Você é um meta-orquestrador de agentes IA para criação de conteúdo YouTube.
Dado um objetivo, escolha quais agentes chamar e em que ordem para alcançá-lo.

Agentes disponíveis:
${registryForPlanner()}

Regras:
- Use apenas agentes do registro acima.
- Respeite dependências (deps: significa que esses agentes devem rodar antes).
- Use \`reads_from_memory\` para indicar quais saídas de passos anteriores este passo precisa.
- Mantenha o plano enxuto: 3-7 passos no máximo.
- Cada passo deve ter um motivo claro.
- "input" deve usar valores literais OU placeholders \${memory.key} para ler da memória compartilhada.`;

  const userPrompt = `OBJETIVO: ${goal}

${Object.keys(context).length ? `CONTEXTO: ${JSON.stringify(context)}` : ""}

Retorne o plano via tool call.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "submit_plan",
          description: "Submeter o plano de execução",
          parameters: {
            type: "object",
            properties: {
              plan: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    step: { type: "number" },
                    agent: { type: "string" },
                    input: { type: "object" },
                    reason: { type: "string" },
                    reads_from_memory: { type: "array", items: { type: "string" } },
                  },
                  required: ["step", "agent", "input", "reason"],
                },
              },
            },
            required: ["plan"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "submit_plan" } },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Planner LLM failed (${resp.status}): ${txt.slice(0, 200)}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("Planner returned no tool call");

  const args = JSON.parse(toolCall.function.arguments);
  const plan = args.plan as PlanStep[];

  // Validate every agent exists
  for (const step of plan) {
    if (!getAgent(step.agent)) {
      throw new Error(`Plan references unknown agent: ${step.agent}`);
    }
  }
  return plan;
}

/** Resolve ${memory.key} placeholders in input values. */
function resolveInput(
  input: Record<string, unknown>,
  memory: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string") {
      const m = v.match(/^\$\{memory\.(.+)\}$/);
      if (m) {
        resolved[k] = memory[m[1]] ?? null;
        continue;
      }
    }
    resolved[k] = v;
  }
  return resolved;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const { action } = body;

    // Auth: extract user from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // ========== START NEW RUN ==========
    if (action === "start") {
      const { goal, context = {} } = body;
      if (!goal || typeof goal !== "string") throw new Error("goal is required");

      const span = await startSpan(req, "meta-orchestrator", {
        userId: user.id,
        input: { goal, context },
      });

      // Create run row
      const { data: run, error: runErr } = await sb.from("agent_runs").insert({
        user_id: user.id,
        goal,
        context,
        status: "planning",
        trace_id: span.traceId,
      }).select().single();
      if (runErr) throw runErr;

      // Plan
      let plan: PlanStep[];
      try {
        plan = await planWithLLM(goal, context);
      } catch (e: any) {
        await sb.from("agent_runs").update({
          status: "failed",
          error_message: `Planning failed: ${e.message}`,
        }).eq("id", run.id);
        await span.end("error", null, e.message);
        throw e;
      }

      await sb.from("agent_runs").update({
        plan,
        total_steps: plan.length,
        status: "running",
      }).eq("id", run.id);

      // Fire-and-forget execution
      executeRun(run.id, plan, user.id, span).catch(async (e) => {
        console.error("Run execution failed:", e);
        await sb.from("agent_runs").update({
          status: "failed",
          error_message: e.message?.slice(0, 1000) ?? "Unknown error",
          completed_at: new Date().toISOString(),
        }).eq("id", run.id);
        await span.end("error", null, e.message);
      });

      return new Response(JSON.stringify({ run_id: run.id, plan, trace_id: span.traceId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET RUN STATUS ==========
    if (action === "status") {
      const { run_id } = body;
      const { data: run } = await sb.from("agent_runs").select("*").eq("id", run_id).single();
      const { data: memory } = await sb.from("agent_memory")
        .select("*").eq("run_id", run_id).order("created_at");
      return new Response(JSON.stringify({ run, memory: memory ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Execute the plan step-by-step with shared memory. */
async function executeRun(runId: string, plan: PlanStep[], userId: string, parentSpan: any) {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const memory: Record<string, unknown> = {};

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const agent = getAgent(step.agent)!;

    await sb.from("agent_runs").update({ current_step: i + 1 }).eq("id", runId);

    try {
      const resolvedInput = resolveInput(step.input, memory);

      const result: any = await callEdgeFn(agent.function_name, resolvedInput, {
        parentSpan,
        userId,
        timeoutMs: 120_000,
      });

      // Write declared output keys to memory
      const memWrites: Array<{ run_id: string; key: string; value: unknown; written_by: string; step_index: number }> = [];
      for (const key of agent.output_keys) {
        const val = result?.[key] ?? result;
        memory[key] = val;
        memWrites.push({
          run_id: runId,
          key,
          value: val == null ? null : val,
          written_by: agent.name,
          step_index: i + 1,
        });
      }
      // Also store full raw result under a namespaced key
      memWrites.push({
        run_id: runId,
        key: `step_${i + 1}_raw`,
        value: result,
        written_by: agent.name,
        step_index: i + 1,
      });
      memory[`step_${i + 1}_raw`] = result;

      if (memWrites.length) await sb.from("agent_memory").insert(memWrites);
    } catch (e: any) {
      await sb.from("agent_runs").update({
        status: "failed",
        error_message: `Step ${i + 1} (${step.agent}) failed: ${e.message}`.slice(0, 1000),
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
      await parentSpan.end("error", null, e.message);
      return;
    }
  }

  // Done
  await sb.from("agent_runs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    result_summary: { keys: Object.keys(memory) },
  }).eq("id", runId);
  await parentSpan.end("success", { steps: plan.length, memory_keys: Object.keys(memory) });
}
