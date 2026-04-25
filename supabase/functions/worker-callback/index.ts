// VPS Worker callback endpoint
// Handles: heartbeat, event, extend_lease, complete
// Auth: header `x-worker-token` must match env WORKER_API_TOKEN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_TOKEN = Deno.env.get("WORKER_API_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ----- Auth -----
  if (!WORKER_TOKEN) {
    return json(
      { error: "server_misconfigured", detail: "WORKER_API_TOKEN not set" },
      503,
    );
  }
  const provided = req.headers.get("x-worker-token") ?? "";
  if (provided !== WORKER_TOKEN) {
    return json({ error: "unauthorized" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = String(payload?.action ?? "");
  const worker_id = String(payload?.worker_id ?? "").trim();
  if (!worker_id) return json({ error: "worker_id_required" }, 400);

  try {
    switch (action) {
      // -----------------------------------------------------------
      case "heartbeat": {
        const {
          current_project_id = null,
          stage = "idle",
          progress_pct = null,
          meta = {},
        } = payload;

        const { error } = await supabase
          .from("worker_heartbeats")
          .upsert(
            {
              worker_id,
              last_seen: new Date().toISOString(),
              current_project_id,
              current_stage: stage,
              progress_pct,
              meta,
            },
            { onConflict: "worker_id" },
          );
        if (error) throw error;
        return json({ ok: true });
      }

      // -----------------------------------------------------------
      case "event": {
        const {
          project_id,
          stage,
          status,
          message = null,
          cost_usd = 0,
          duration_ms = null,
          metadata = {},
        } = payload;

        if (!project_id || !stage || !status) {
          return json({ error: "missing_fields" }, 400);
        }

        const { error } = await supabase.from("project_events").insert({
          project_id,
          worker_id,
          stage,
          status,
          message,
          cost_usd,
          duration_ms,
          metadata,
        });
        if (error) throw error;

        // If failed, increment retry_count and clear claim so recover/retry kicks in
        if (status === "failed") {
          const { data: proj } = await supabase
            .from("video_projects")
            .select("retry_count, max_retries")
            .eq("id", project_id)
            .single();
          const currentRetries = proj?.retry_count ?? 0;
          const maxRetries = proj?.max_retries ?? 3;
          const exhausted = currentRetries + 1 >= maxRetries;

          await supabase
            .from("video_projects")
            .update({
              retry_count: currentRetries + 1,
              error_message: message ?? `Failed at stage ${stage}`,
              status: exhausted ? "failed" : "ready_for_production",
              worker_id: null,
              claimed_at: null,
              claim_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", project_id);
        }

        return json({ ok: true });
      }

      // -----------------------------------------------------------
      case "extend_lease": {
        const { project_id, additional_minutes = 60 } = payload;
        if (!project_id) return json({ error: "project_id_required" }, 400);

        const { data, error } = await supabase
          .from("video_projects")
          .update({
            claim_expires_at: new Date(
              Date.now() + Number(additional_minutes) * 60_000,
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", project_id)
          .eq("worker_id", worker_id) // only the owner can extend
          .select("id, claim_expires_at")
          .single();

        if (error) throw error;
        if (!data) return json({ error: "not_owner_or_not_found" }, 403);
        return json({ ok: true, claim_expires_at: data.claim_expires_at });
      }

      // -----------------------------------------------------------
      case "complete": {
        const {
          project_id,
          youtube_video_id = null,
          rendered_video_url = null,
          sha256 = null,
          total_cost_usd = 0,
          duration_seconds = null,
        } = payload;
        if (!project_id) return json({ error: "project_id_required" }, 400);

        // Confirm ownership
        const { data: proj, error: projErr } = await supabase
          .from("video_projects")
          .select("id, user_id, channel_id_ref, worker_id, title")
          .eq("id", project_id)
          .single();
        if (projErr) throw projErr;
        if (proj.worker_id !== worker_id) {
          return json({ error: "not_owner" }, 403);
        }

        // Mark project as published
        const { error: updErr } = await supabase
          .from("video_projects")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            rendered_video_url,
            rendered_video_sha256: sha256,
            total_render_cost_usd: total_cost_usd,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", project_id);
        if (updErr) throw updErr;

        // Performance row (best-effort)
        if (youtube_video_id) {
          await supabase.from("video_performance").upsert(
            {
              project_id,
              user_id: proj.user_id,
              channel_id: proj.channel_id_ref,
              youtube_video_id,
              published_at: new Date().toISOString(),
            },
            { onConflict: "project_id" },
          ).then(() => {}, () => {});
        }

        // Update channel last_posted_at
        if (proj.channel_id_ref) {
          await supabase.rpc("noop"); // placeholder; safe no-op
          await supabase
            .from("user_channels")
            .update({
              last_posted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", proj.channel_id_ref)
            .then(() => {}, () => {});
        }

        // Mark schedule slot as published if exists
        await supabase
          .from("channel_schedule")
          .update({ status: "published", updated_at: new Date().toISOString() })
          .eq("video_project_id", project_id)
          .then(() => {}, () => {});

        // Clear heartbeat -> idle
        await supabase
          .from("worker_heartbeats")
          .upsert(
            {
              worker_id,
              last_seen: new Date().toISOString(),
              current_project_id: null,
              current_stage: "idle",
              progress_pct: 100,
            },
            { onConflict: "worker_id" },
          )
          .then(() => {}, () => {});

        // Final completion event
        await supabase.from("project_events").insert({
          project_id,
          worker_id,
          stage: "complete",
          status: "completed",
          message: youtube_video_id
            ? `Published as ${youtube_video_id}`
            : "Render complete",
          cost_usd: total_cost_usd,
          duration_ms: duration_seconds ? duration_seconds * 1000 : null,
          metadata: { youtube_video_id, rendered_video_url, sha256 },
        });

        return json({ ok: true, project_id, status: "published" });
      }

      // -----------------------------------------------------------
      default:
        return json({ error: "unknown_action", action }, 400);
    }
  } catch (err) {
    console.error("[worker-callback] error", err);
    return json({ error: "internal_error", detail: String(err?.message ?? err) }, 500);
  }
});
