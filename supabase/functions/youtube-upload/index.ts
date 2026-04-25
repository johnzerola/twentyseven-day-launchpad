// supabase/functions/youtube-upload/index.ts
//
// YouTube upload orchestrator (server-side helper for the VPS Python worker).
//
// Endpoints (action in body):
//   - "init":       Create resumable session URI for a project (refreshes OAuth token).
//   - "refresh":    Refresh OAuth access token only.
//   - "complete":   Mark project as published; sync youtube_video_id, url, published_at.
//                   Idempotent via project.idempotency_key.
//   - "fail":       Record a failed attempt and decide retry/backoff or give up.
//   - "metadata":   Apply title/description/tags to an already-uploaded video (PATCH videos.update).
//
// Auth: requires header `x-worker-token: <WORKER_API_TOKEN>` matching the secret.
// (Same token used by /worker-callback so the VPS only needs one.)

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

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Backoff: 5min, 30min, 2h, 8h, 24h (max 5 attempts)
const BACKOFF_MINUTES = [5, 30, 120, 480, 1440];
const MAX_UPLOAD_ATTEMPTS = 5;

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

// ---------- OAuth helpers ----------

interface ChannelTokens {
  id: string;
  youtube_refresh_token: string | null;
  youtube_access_token: string | null;
  youtube_token_expires_at: string | null;
}

async function refreshAccessToken(channel: ChannelTokens): Promise<string> {
  if (!channel.youtube_refresh_token) {
    throw new Error("channel has no youtube_refresh_token; reconnect OAuth");
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
    throw new Error(`token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const accessToken: string = data.access_token;
  const expiresIn: number = data.expires_in ?? 3600;
  const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();

  await admin
    .from("user_channels")
    .update({
      youtube_access_token: accessToken,
      youtube_token_expires_at: expiresAt,
    })
    .eq("id", channel.id);

  return accessToken;
}

async function getValidAccessToken(channelId: string): Promise<string> {
  const { data, error } = await admin
    .from("user_channels")
    .select(
      "id, youtube_refresh_token, youtube_access_token, youtube_token_expires_at",
    )
    .eq("id", channelId)
    .maybeSingle();

  if (error || !data) throw new Error("channel not found");

  const expiresAt = data.youtube_token_expires_at
    ? new Date(data.youtube_token_expires_at).getTime()
    : 0;
  const now = Date.now();

  if (data.youtube_access_token && expiresAt > now + 30_000) {
    return data.youtube_access_token;
  }
  return refreshAccessToken(data);
}

// ---------- Action: init ----------
// Creates a resumable upload session URI on YouTube and stores it on the project.
// The Python worker then PUTs the bytes directly to that URI.

async function actionInit(body: any) {
  const projectId: string = body.project_id;
  const workerId: string = body.worker_id ?? "unknown";
  const fileSize: number = Number(body.file_size_bytes ?? 0);
  const mimeType: string = body.mime_type ?? "video/mp4";

  if (!projectId) return json({ error: "project_id required" }, 400);
  if (!fileSize) return json({ error: "file_size_bytes required" }, 400);

  const { data: project, error } = await admin
    .from("video_projects")
    .select(
      "id, channel_id_ref, title, description, tags, youtube_category_id, privacy_status, made_for_kids, idempotency_key, upload_session_uri, upload_attempts, youtube_video_id",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project) return json({ error: "project not found" }, 404);

  // Idempotency: already published
  if (project.youtube_video_id) {
    return json({
      already_published: true,
      youtube_video_id: project.youtube_video_id,
    });
  }

  // Reuse existing session URI (resumable for up to 7 days)
  if (project.upload_session_uri) {
    return json({
      reused: true,
      upload_session_uri: project.upload_session_uri,
      idempotency_key: project.idempotency_key,
    });
  }

  if (!project.channel_id_ref) {
    return json({ error: "project has no channel_id_ref" }, 400);
  }

  const accessToken = await getValidAccessToken(project.channel_id_ref);

  const snippet = {
    title: (project.title ?? "Untitled").slice(0, 100),
    description: (project.description ?? "").slice(0, 5000),
    tags: Array.isArray(project.tags) ? project.tags.slice(0, 30) : [],
    categoryId: String(project.youtube_category_id ?? 22),
  };
  const status = {
    privacyStatus: project.privacy_status ?? "private",
    selfDeclaredMadeForKids: !!project.made_for_kids,
    embeddable: true,
  };

  const initUrl =
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

  const ytRes = await fetch(initUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(fileSize),
      "X-Upload-Content-Type": mimeType,
    },
    body: JSON.stringify({ snippet, status }),
  });

  if (!ytRes.ok) {
    const text = await ytRes.text();
    await admin.from("youtube_upload_attempts").insert({
      project_id: projectId,
      worker_id: workerId,
      attempt_number: (project.upload_attempts ?? 0) + 1,
      status: "failed",
      error_message: `init failed: ${text}`,
      http_status: ytRes.status,
      total_bytes: fileSize,
    });
    return json(
      { error: "youtube init failed", status: ytRes.status, body: text },
      502,
    );
  }

  const sessionUri = ytRes.headers.get("location");
  if (!sessionUri) {
    return json({ error: "no Location header in YouTube response" }, 502);
  }

  await admin
    .from("video_projects")
    .update({
      upload_session_uri: sessionUri,
      upload_started_at: new Date().toISOString(),
      status: "uploading",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  await admin.from("youtube_upload_attempts").insert({
    project_id: projectId,
    worker_id: workerId,
    attempt_number: (project.upload_attempts ?? 0) + 1,
    status: "session_created",
    upload_session_uri: sessionUri,
    total_bytes: fileSize,
  });

  return json({
    upload_session_uri: sessionUri,
    idempotency_key: project.idempotency_key,
    access_token: accessToken, // worker uses this for PUT chunks
    snippet,
    status,
  });
}

// ---------- Action: refresh ----------

async function actionRefresh(body: any) {
  const channelId: string = body.channel_id;
  if (!channelId) return json({ error: "channel_id required" }, 400);
  const token = await getValidAccessToken(channelId);
  return json({ access_token: token });
}

// ---------- Action: complete ----------

async function actionComplete(body: any) {
  const projectId: string = body.project_id;
  const workerId: string = body.worker_id ?? "unknown";
  const youtubeVideoId: string = body.youtube_video_id;
  const idempotencyKey: string | undefined = body.idempotency_key;

  if (!projectId || !youtubeVideoId) {
    return json(
      { error: "project_id and youtube_video_id required" },
      400,
    );
  }

  const { data: project } = await admin
    .from("video_projects")
    .select("id, idempotency_key, youtube_video_id, channel_id_ref")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return json({ error: "project not found" }, 404);

  // Idempotency check
  if (
    idempotencyKey && project.idempotency_key &&
    idempotencyKey !== project.idempotency_key
  ) {
    return json({ error: "idempotency_key mismatch" }, 409);
  }

  if (project.youtube_video_id && project.youtube_video_id === youtubeVideoId) {
    return json({
      already_published: true,
      youtube_video_id: project.youtube_video_id,
    });
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
  const now = new Date().toISOString();

  await admin
    .from("video_projects")
    .update({
      youtube_video_id: youtubeVideoId,
      youtube_url: youtubeUrl,
      published_at: now,
      upload_completed_at: now,
      status: "published",
      worker_id: null,
      claim_expires_at: null,
      error_message: null,
      updated_at: now,
    })
    .eq("id", projectId);

  await admin.from("youtube_upload_attempts").insert({
    project_id: projectId,
    worker_id: workerId,
    attempt_number: 0,
    status: "completed",
    youtube_video_id: youtubeVideoId,
  });

  // Bump channel stats
  if (project.channel_id_ref) {
    await admin.rpc("set_updated_at"); // no-op safe; update channel via raw
    const { data: ch } = await admin
      .from("user_channels")
      .select("total_videos_posted")
      .eq("id", project.channel_id_ref)
      .maybeSingle();
    await admin
      .from("user_channels")
      .update({
        total_videos_posted: (ch?.total_videos_posted ?? 0) + 1,
        last_posted_at: now,
      })
      .eq("id", project.channel_id_ref);
  }

  await admin.from("project_events").insert({
    project_id: projectId,
    worker_id: workerId,
    stage: "publish",
    status: "completed",
    message: `Published as ${youtubeVideoId}`,
  });

  return json({
    success: true,
    youtube_video_id: youtubeVideoId,
    youtube_url: youtubeUrl,
    published_at: now,
  });
}

// ---------- Action: fail ----------

async function actionFail(body: any) {
  const projectId: string = body.project_id;
  const workerId: string = body.worker_id ?? "unknown";
  const reason: string = body.reason ?? "unknown";
  const errorMessage: string = body.error_message ?? "";
  const httpStatus: number | null = body.http_status ?? null;
  const quotaExceeded = reason === "quota" || httpStatus === 403;

  if (!projectId) return json({ error: "project_id required" }, 400);

  const { data: project } = await admin
    .from("video_projects")
    .select("id, upload_attempts")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return json({ error: "project not found" }, 404);

  const attempts = (project.upload_attempts ?? 0) + 1;
  const giveUp = attempts >= MAX_UPLOAD_ATTEMPTS;

  // Quota: park for 24h, regardless of attempts (don't burn retries)
  const backoffMin = quotaExceeded
    ? 24 * 60
    : BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
  const nextRetryAt = giveUp
    ? null
    : new Date(Date.now() + backoffMin * 60_000).toISOString();

  await admin
    .from("video_projects")
    .update({
      upload_attempts: attempts,
      last_upload_attempt_at: new Date().toISOString(),
      next_retry_at: nextRetryAt,
      error_message: errorMessage.slice(0, 1000),
      last_error_at: new Date().toISOString(),
      status: giveUp ? "failed" : "upload_failed",
      worker_id: null,
      claim_expires_at: null,
      // Don't clear upload_session_uri unless it's a token issue or we gave up
      upload_session_uri: (giveUp || reason === "session_expired") ? null : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  await admin.from("youtube_upload_attempts").insert({
    project_id: projectId,
    worker_id: workerId,
    attempt_number: attempts,
    status: quotaExceeded ? "quota_exceeded" : "failed",
    error_message: errorMessage,
    error_code: reason,
    http_status: httpStatus,
  });

  await admin.from("project_events").insert({
    project_id: projectId,
    worker_id: workerId,
    stage: "publish",
    status: giveUp ? "failed_permanent" : "failed",
    message: `Upload attempt ${attempts}/${MAX_UPLOAD_ATTEMPTS} failed: ${reason} — ${errorMessage}`,
  });

  return json({
    attempts,
    next_retry_at: nextRetryAt,
    given_up: giveUp,
    backoff_minutes: backoffMin,
  });
}

// ---------- Action: metadata ----------
// Update title/description/tags on an already-uploaded video (videos.update).

async function actionMetadata(body: any) {
  const projectId: string = body.project_id;
  if (!projectId) return json({ error: "project_id required" }, 400);

  const { data: project } = await admin
    .from("video_projects")
    .select(
      "id, channel_id_ref, youtube_video_id, title, description, tags, youtube_category_id, privacy_status",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return json({ error: "project not found" }, 404);
  if (!project.youtube_video_id) {
    return json({ error: "project not yet published to YouTube" }, 400);
  }
  if (!project.channel_id_ref) {
    return json({ error: "project has no channel_id_ref" }, 400);
  }

  const accessToken = await getValidAccessToken(project.channel_id_ref);

  const ytBody = {
    id: project.youtube_video_id,
    snippet: {
      title: (project.title ?? "Untitled").slice(0, 100),
      description: (project.description ?? "").slice(0, 5000),
      tags: Array.isArray(project.tags) ? project.tags.slice(0, 30) : [],
      categoryId: String(project.youtube_category_id ?? 22),
    },
    status: {
      privacyStatus: project.privacy_status ?? "private",
    },
  };

  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/videos?part=snippet,status",
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ytBody),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    return json(
      { error: "metadata update failed", status: res.status, body: text },
      502,
    );
  }

  return json({ success: true, updated: ytBody });
}

// ---------- Router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  if (!authOk(req)) {
    return json({ error: "unauthorized: invalid x-worker-token" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const action: string = body.action;

  try {
    switch (action) {
      case "init":
        return await actionInit(body);
      case "refresh":
        return await actionRefresh(body);
      case "complete":
        return await actionComplete(body);
      case "fail":
        return await actionFail(body);
      case "metadata":
        return await actionMetadata(body);
      default:
        return json(
          {
            error:
              "unknown action; expected init|refresh|complete|fail|metadata",
          },
          400,
        );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[youtube-upload] error:", msg);
    return json({ error: msg }, 500);
  }
});
