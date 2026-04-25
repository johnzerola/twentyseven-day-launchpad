// supabase/functions/youtube-channel-credentials/index.ts
//
// Endpoint para o worker Python da VPS obter um access_token válido (e o
// refresh_token, se necessário) de um canal autorizado pelo dono.
//
// Auth: header `x-worker-token: <WORKER_API_TOKEN>`.
//
// POST body:
//   { channel_id?: string, youtube_channel_id?: string, project_id?: string }
//   Pelo menos um identificador é obrigatório. Se vier project_id, resolve
//   automaticamente o canal via video_projects.channel_id_ref.
//
// Resposta:
//   {
//     channel_id: uuid,
//     youtube_channel_id: string,
//     channel_name: string,
//     access_token: string,         // SEMPRE válido (refresca se preciso)
//     token_expires_at: ISO8601,
//     refresh_token: string,        // para a VPS armazenar localmente se quiser
//     scopes: string[],
//     has_upload_scope: boolean
//   }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_API_TOKEN = Deno.env.get("WORKER_API_TOKEN");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

const REQUIRED_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function authOk(req: Request): boolean {
  if (!WORKER_API_TOKEN) return false;
  const t = req.headers.get("x-worker-token");
  return !!t && t === WORKER_API_TOKEN;
}

interface ChannelRow {
  id: string;
  channel_name: string | null;
  youtube_channel_id: string | null;
  youtube_refresh_token: string | null;
  youtube_access_token: string | null;
  youtube_token_expires_at: string | null;
  youtube_oauth_scope: string | null;
}

async function refreshAccessToken(channel: ChannelRow): Promise<{
  access_token: string;
  expires_at: string;
}> {
  if (!channel.youtube_refresh_token) {
    throw new Error("channel has no youtube_refresh_token; ask the user to reconnect OAuth");
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: channel.youtube_refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`token_refresh_failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const access_token: string = data.access_token;
  const expires_in: number = data.expires_in ?? 3600;
  const expires_at = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();

  await admin
    .from("user_channels")
    .update({
      youtube_access_token: access_token,
      youtube_token_expires_at: expires_at,
    })
    .eq("id", channel.id);

  return { access_token, expires_at };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!WORKER_API_TOKEN) {
    return json({ error: "server_misconfigured", detail: "WORKER_API_TOKEN not set" }, 500);
  }
  if (!authOk(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  let { channel_id, youtube_channel_id, project_id } = body ?? {};

  // Resolve channel via project if necessary
  if (!channel_id && !youtube_channel_id && project_id) {
    const { data: proj, error } = await admin
      .from("video_projects")
      .select("channel_id_ref")
      .eq("id", project_id)
      .maybeSingle();
    if (error || !proj?.channel_id_ref) {
      return json({ error: "project_not_found_or_no_channel" }, 404);
    }
    channel_id = proj.channel_id_ref;
  }

  if (!channel_id && !youtube_channel_id) {
    return json({ error: "channel_id, youtube_channel_id or project_id required" }, 400);
  }

  const q = admin
    .from("user_channels")
    .select(
      "id, channel_name, youtube_channel_id, youtube_refresh_token, youtube_access_token, youtube_token_expires_at, youtube_oauth_scope",
    )
    .limit(1);

  const { data, error } = channel_id
    ? await q.eq("id", channel_id).maybeSingle()
    : await q.eq("youtube_channel_id", youtube_channel_id).maybeSingle();

  if (error || !data) return json({ error: "channel_not_found" }, 404);
  const channel = data as ChannelRow;

  if (!channel.youtube_refresh_token) {
    return json({
      error: "channel_not_authorized",
      detail: "User has not connected YouTube OAuth for this channel yet.",
    }, 409);
  }

  // Refresh if missing or expiring within 60s
  const now = Date.now();
  const expMs = channel.youtube_token_expires_at
    ? new Date(channel.youtube_token_expires_at).getTime()
    : 0;

  let access_token = channel.youtube_access_token ?? "";
  let expires_at = channel.youtube_token_expires_at ?? "";

  if (!access_token || expMs <= now + 60_000) {
    try {
      const refreshed = await refreshAccessToken(channel);
      access_token = refreshed.access_token;
      expires_at = refreshed.expires_at;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: "refresh_failed", detail: msg }, 502);
    }
  }

  const scopes = (channel.youtube_oauth_scope ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const has_upload_scope = scopes.includes(REQUIRED_UPLOAD_SCOPE);

  return json({
    channel_id: channel.id,
    youtube_channel_id: channel.youtube_channel_id,
    channel_name: channel.channel_name,
    access_token,
    token_expires_at: expires_at,
    refresh_token: channel.youtube_refresh_token,
    scopes,
    has_upload_scope,
    warning: has_upload_scope
      ? null
      : "Channel was authorized BEFORE the upload scope was added. User must reconnect to grant youtube.upload.",
  });
});
