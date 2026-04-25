import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// PRE-UPLOAD GUARD (safety net)
// Last gate before publishing to YouTube. Validates:
//   1) Script: monetization risk + originality (uses internal scores)
//   2) Title:  click-bait/policy/length (Gemini text)
//   3) Thumb:  visual policy via Gemini Vision (text/image)
//
// Output:
//   action ∈ allow | regenerate | manual_review | block
// Persisted in pre_upload_audits and linked on video_projects.
// ═══════════════════════════════════════════════════════════════

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface AuditResult {
  passed: boolean;
  action: "allow" | "regenerate" | "manual_review" | "block";
  composite_score: number;
  monetiza_score: number | null;
  originality_score: number | null;
  thumbnail_score: number | null;
  title_score: number | null;
  issues: Array<{
    layer: "script" | "title" | "thumbnail";
    severity: "low" | "medium" | "high" | "critical";
    code: string;
    detail: string;
  }>;
  recommendations: string[];
  raw_responses: Record<string, any>;
}

async function callGemini(messages: any[], model = "google/gemini-2.5-flash") {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const r = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`gemini ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

function parseJson(text: string): any {
  const cleaned = (text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function auditTitle(title: string): Promise<{
  score: number;
  issues: AuditResult["issues"];
}> {
  const sys = `Você é auditor de títulos do YouTube. Retorne JSON estrito com:
{ "score": 0-100, "issues": [{ "severity": "low|medium|high|critical", "code": string, "detail": string }] }
Avalie: claim falso, baiting agressivo, política do YouTube (violência/discurso/menores), conteúdo enganoso, comprimento (>100 chars = penaliza).`;
  const usr = `Título: "${title}"\nSeja rigoroso.`;
  const r = await callGemini([
    { role: "system", content: sys },
    { role: "user", content: usr },
  ]);
  const txt = r.choices?.[0]?.message?.content || "";
  const j = parseJson(txt) || { score: 70, issues: [] };
  return {
    score: Math.max(0, Math.min(100, Number(j.score) || 0)),
    issues: (j.issues || []).map((i: any) => ({
      layer: "title" as const,
      severity: i.severity || "low",
      code: i.code || "title_issue",
      detail: i.detail || "",
    })),
  };
}

async function auditThumbnail(thumbnailUrl: string | null, title: string): Promise<{
  score: number | null;
  issues: AuditResult["issues"];
}> {
  if (!thumbnailUrl) {
    return {
      score: null,
      issues: [
        {
          layer: "thumbnail",
          severity: "medium",
          code: "missing_thumbnail",
          detail: "No thumbnail provided for audit",
        },
      ],
    };
  }
  const sys = `Você é auditor de thumbnails do YouTube. Retorne JSON: { "score": 0-100, "issues": [{ "severity": ..., "code": ..., "detail": ... }] }
Verifique: violência gráfica, nudez, choque desnecessário, texto ilegível, claims falsos vs título, qualidade visual.`;
  const r = await callGemini([
    { role: "system", content: sys },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Título do vídeo: "${title}". Avalie a thumbnail.`,
        },
        { type: "image_url", image_url: { url: thumbnailUrl } },
      ] as any,
    },
  ], "google/gemini-2.5-flash");
  const txt = r.choices?.[0]?.message?.content || "";
  const j = parseJson(txt) || { score: 70, issues: [] };
  return {
    score: Math.max(0, Math.min(100, Number(j.score) || 0)),
    issues: (j.issues || []).map((i: any) => ({
      layer: "thumbnail" as const,
      severity: i.severity || "low",
      code: i.code || "thumb_issue",
      detail: i.detail || "",
    })),
  };
}

function decideAction(
  composite: number,
  issues: AuditResult["issues"]
): AuditResult["action"] {
  const hasCritical = issues.some((i) => i.severity === "critical");
  const highCount = issues.filter((i) => i.severity === "high").length;
  if (hasCritical) return "block";
  if (composite < 40 || highCount >= 2) return "manual_review";
  if (composite < 60 || highCount >= 1) return "regenerate";
  return "allow";
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const startTs = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const { project_id, user_id: bodyUserId, persist = true } = body || {};
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load project
    const { data: project, error: projErr } = await sb
      .from("video_projects")
      .select(
        "id,user_id,channel_id_ref,title,description,script,thumbnail_url,monetization_score,originality_score,intelligence_json"
      )
      .eq("id", project_id)
      .maybeSingle();

    if (projErr || !project) {
      return new Response(
        JSON.stringify({ error: "project_not_found", details: projErr?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = project.user_id || bodyUserId;
    const issues: AuditResult["issues"] = [];
    const recommendations: string[] = [];
    const raw: Record<string, any> = {};

    // 1) Existing scores from upstream functions
    const monetiza_score = project.monetization_score != null
      ? Number(project.monetization_score)
      : null;
    const originality_score = project.originality_score != null
      ? Number(project.originality_score)
      : null;

    if (monetiza_score != null && monetiza_score < 60) {
      issues.push({
        layer: "script",
        severity: monetiza_score < 40 ? "critical" : "high",
        code: "monetization_risk",
        detail: `Monetiza score ${monetiza_score}/100 — risco de desmonetização`,
      });
      recommendations.push(
        "Suavizar linguagem sensível e regenerar o roteiro com tom neutro"
      );
    }
    if (originality_score != null && originality_score < 50) {
      issues.push({
        layer: "script",
        severity: originality_score < 30 ? "critical" : "high",
        code: "low_originality",
        detail: `Originalidade ${originality_score}/100 — risco de strike por reuso`,
      });
      recommendations.push(
        "Regenerar com ângulo único; evitar paráfrase de fontes existentes"
      );
    }

    // 2) Title audit
    let title_score: number | null = null;
    try {
      const ta = await auditTitle(project.title || "");
      title_score = ta.score;
      issues.push(...ta.issues);
      raw.title = { score: ta.score, issues: ta.issues };
      if (ta.score < 60) {
        recommendations.push("Reescrever título: reduzir bait/claim e ajustar comprimento");
      }
    } catch (e: any) {
      console.warn("title audit failed:", e?.message);
      raw.title = { error: e?.message || "title audit failed" };
    }

    // 3) Thumbnail audit (Gemini Vision)
    let thumbnail_score: number | null = null;
    try {
      const th = await auditThumbnail(
        project.thumbnail_url || null,
        project.title || ""
      );
      thumbnail_score = th.score;
      issues.push(...th.issues);
      raw.thumbnail = { score: th.score, issues: th.issues };
      if (th.score != null && th.score < 60) {
        recommendations.push("Trocar thumbnail: melhorar contraste/legibilidade ou remover elementos sensíveis");
      }
    } catch (e: any) {
      console.warn("thumb audit failed:", e?.message);
      raw.thumbnail = { error: e?.message || "thumbnail audit failed" };
    }

    // 4) Composite score (weighted average of available signals)
    const parts: number[] = [];
    if (monetiza_score != null) parts.push(monetiza_score);
    if (originality_score != null) parts.push(originality_score);
    if (title_score != null) parts.push(title_score);
    if (thumbnail_score != null) parts.push(thumbnail_score);
    const composite_score = parts.length
      ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
      : 0;

    const action = decideAction(composite_score, issues);
    const passed = action === "allow";

    const audit: AuditResult = {
      passed,
      action,
      composite_score,
      monetiza_score,
      originality_score,
      thumbnail_score,
      title_score,
      issues,
      recommendations,
      raw_responses: raw,
    };

    // 5) Persist
    let auditId: string | null = null;
    if (persist) {
      const { data: ins, error: insErr } = await sb
        .from("pre_upload_audits")
        .insert({
          project_id: project.id,
          user_id: userId,
          channel_id: project.channel_id_ref,
          passed,
          action,
          composite_score,
          monetiza_score,
          originality_score,
          thumbnail_score,
          title_score,
          issues_json: issues,
          recommendations_json: recommendations,
          raw_responses: raw,
          duration_ms: Date.now() - startTs,
        })
        .select("id")
        .maybeSingle();

      if (!insErr && ins) {
        auditId = ins.id;
        await sb
          .from("video_projects")
          .update({
            pre_upload_audit_id: auditId,
            pre_upload_passed: passed,
            updated_at: new Date().toISOString(),
          })
          .eq("id", project.id)
          .then(() => {}, () => {});
      } else if (insErr) {
        console.warn("audit persist failed:", insErr.message);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        audit_id: auditId,
        ...audit,
        duration_ms: Date.now() - startTs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("pre-upload-guard error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
