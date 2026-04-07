import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateB64 = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(redirectHtml("Autorização cancelada."), {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    if (!code || !stateB64) {
      return new Response(redirectHtml("Parâmetros inválidos."), {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    // Decode and validate the signed state token
    let statePayload: { userId: string; nonce: string; exp: number };
    try {
      const decoded = atob(stateB64.replace(/-/g, "+").replace(/_/g, "/"));
      statePayload = JSON.parse(decoded);
    } catch {
      return new Response(redirectHtml("Estado inválido."), {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    const { userId, nonce, exp } = statePayload;

    // Check expiration
    if (!userId || !nonce || !exp || Date.now() > exp) {
      return new Response(redirectHtml("Token expirado. Tente novamente."), {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the nonce exists in the database and belongs to the user
    const { data: stateRow, error: stateError } = await supabase
      .from("oauth_state_tokens")
      .select("id")
      .eq("nonce", nonce)
      .eq("user_id", userId)
      .maybeSingle();

    if (stateError || !stateRow) {
      return new Response(redirectHtml("Token inválido. Tente novamente."), {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    // Delete the used nonce to prevent replay
    await supabase.from("oauth_state_tokens").delete().eq("nonce", nonce);

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/youtube-oauth-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      console.error("Token exchange error:", tokens);
      return new Response(redirectHtml(`Erro: ${tokens.error_description || tokens.error}`), {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    // Get channel info with snippet AND statistics
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      return new Response(redirectHtml("Nenhum canal encontrado nesta conta Google."), {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    // 1. Save OAuth tokens
    const { error: dbError } = await supabase
      .from("youtube_oauth_tokens")
      .upsert({
        user_id: userId,
        channel_id: channel.id,
        channel_name: channel.snippet.title,
        channel_thumbnail: channel.snippet.thumbnails?.default?.url,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        scopes: tokens.scope?.split(" ") || [],
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,channel_id",
      });

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(redirectHtml("Erro ao salvar conexão."), {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    // 2. Also sync to user_channels so the channel gets ALL platform features
    const stats = channel.statistics;
    try {
      const { error: syncError } = await supabase
        .from("user_channels")
        .upsert({
          user_id: userId,
          youtube_channel_id: channel.id,
          channel_name: channel.snippet.title,
          thumbnail: channel.snippet.thumbnails?.default?.url,
          subscribers: parseInt(stats?.subscriberCount || "0"),
          views: parseInt(stats?.viewCount || "0"),
          videos: parseInt(stats?.videoCount || "0"),
        }, {
          onConflict: "user_id,youtube_channel_id",
          ignoreDuplicates: false,
        });

      if (syncError) {
        console.error("Sync to user_channels error:", syncError);
      }
    } catch (syncErr) {
      console.error("Failed to sync to user_channels:", syncErr);
    }

    return new Response(redirectHtml(`Canal "${channel.snippet.title}" conectado com sucesso! ✅`, true), {
      headers: { "Content-Type": "text/html; charset=UTF-8" },
    });
  } catch (e) {
    console.error("youtube-oauth-callback error:", e);
    return new Response(redirectHtml("Erro interno."), {
      headers: { "Content-Type": "text/html; charset=UTF-8" },
    });
  }
});

function redirectHtml(message: string, success = false): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><title>YouTube OAuth</title>
<style>
  body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
  .card { text-align: center; padding: 2rem; border-radius: 1rem; background: #1a1a1a; border: 1px solid #333; max-width: 400px; }
  .icon { font-size: 3rem; margin-bottom: 1rem; }
  h2 { margin: 0.5rem 0; }
  p { color: #888; font-size: 0.9rem; }
</style>
</head><body>
<div class="card">
  <div class="icon">${success ? '🎉' : '❌'}</div>
  <h2>${message}</h2>
  <p>Você pode fechar esta aba e voltar ao app.</p>
  <script>setTimeout(() => window.close(), 3000);</script>
</div>
</body></html>`;
}
