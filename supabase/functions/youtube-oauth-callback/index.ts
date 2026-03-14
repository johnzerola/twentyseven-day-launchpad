import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(redirectHtml("Autorização cancelada."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code || !userId) {
      return new Response(redirectHtml("Parâmetros inválidos."), {
        headers: { "Content-Type": "text/html" },
      });
    }

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
        headers: { "Content-Type": "text/html" },
      });
    }

    // Get channel info using the access token
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      return new Response(redirectHtml("Nenhum canal encontrado nesta conta Google."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Store tokens in DB using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

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
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response(redirectHtml(`Canal "${channel.snippet.title}" conectado com sucesso! ✅`, true), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (e) {
    console.error("youtube-oauth-callback error:", e);
    return new Response(redirectHtml("Erro interno."), {
      headers: { "Content-Type": "text/html" },
    });
  }
});

function redirectHtml(message: string, success = false): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>YouTube OAuth</title>
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
