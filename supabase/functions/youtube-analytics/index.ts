import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Não autenticado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { channelId, metrics, startDate, endDate } = await req.json();

    // Get stored tokens
    let query = supabase
      .from("youtube_oauth_tokens")
      .select("*")
      .eq("user_id", user.id);

    if (channelId) query = query.eq("channel_id", channelId);

    const { data: tokenRow, error: tokenError } = await query.single();
    if (tokenError || !tokenRow) {
      return new Response(JSON.stringify({ error: "Canal não conectado via OAuth" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh token if expired
    let accessToken = tokenRow.access_token;
    if (new Date(tokenRow.token_expires_at) < new Date()) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      accessToken = refreshed.access_token;

      await supabase
        .from("youtube_oauth_tokens")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", tokenRow.id);
    }

    // Call YouTube Analytics API
    const end = endDate || new Date().toISOString().split("T")[0];
    const start = startDate || new Date(Date.now() - 28 * 86400000).toISOString().split("T")[0];
    const metricsStr = metrics || "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,shares";

    const analyticsUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${tokenRow.channel_id}&startDate=${start}&endDate=${end}&metrics=${metricsStr}&dimensions=day&sort=day`;

    const analyticsRes = await fetch(analyticsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const analyticsData = await analyticsRes.json();

    if (analyticsData.error) {
      console.error("YouTube Analytics API error:", analyticsData.error);
      throw new Error(analyticsData.error.message || "Erro na API do YouTube Analytics");
    }

    return new Response(JSON.stringify({
      channel: {
        id: tokenRow.channel_id,
        name: tokenRow.channel_name,
        thumbnail: tokenRow.channel_thumbnail,
      },
      ...analyticsData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("youtube-analytics error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
