import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SEND VIRAL ALERT — Notifies users via email when pre-viral videos are detected.
 * Called internally by pre-viral-detection when score ≥ 85.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { candidates, niche } = await req.json();
    if (!candidates?.length) throw new Error("No candidates");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get pending alerts not yet sent
    const { data: pendingAlerts } = await sb.from("viral_alerts")
      .select("id, user_id, video_id, video_title, channel_name, pre_viral_score, metadata")
      .is("sent_at", null)
      .gte("pre_viral_score", 85)
      .limit(50);

    if (!pendingAlerts?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user
    const byUser = new Map<string, typeof pendingAlerts>();
    for (const alert of pendingAlerts) {
      const list = byUser.get(alert.user_id) || [];
      list.push(alert);
      byUser.set(alert.user_id, list);
    }

    let totalSent = 0;

    for (const [userId, alerts] of byUser) {
      // Get user email
      const { data: profile } = await sb.from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: { user } } = await sb.auth.admin.getUserById(userId);
      if (!user?.email) continue;

      const videoList = alerts.map(a => 
        `🔥 "${a.video_title}" — ${a.channel_name} (Score: ${Math.round(a.pre_viral_score || 0)})`
      ).join("\n");

      const subject = `🚨 ${alerts.length} vídeo(s) pré-viral detectado(s)${niche ? ` em ${niche}` : ''}!`;
      const html = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f97316;">🚨 Alerta de Vídeo Pré-Viral</h2>
          <p>Olá ${profile?.display_name || 'Creator'},</p>
          <p>Detectamos <strong>${alerts.length} vídeo(s)</strong> com alta probabilidade de viralização${niche ? ` no nicho <strong>${niche}</strong>` : ''}:</p>
          <div style="background: #1a1a2e; color: #e0e0e0; padding: 16px; border-radius: 8px; margin: 16px 0;">
            ${alerts.map(a => `
              <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #333;">
                <div style="font-size: 14px; font-weight: 600;">📹 ${a.video_title}</div>
                <div style="font-size: 12px; color: #aaa; margin-top: 4px;">Canal: ${a.channel_name}</div>
                <div style="font-size: 12px; margin-top: 4px;">
                  <span style="color: #f97316; font-weight: 700;">Score: ${Math.round(a.pre_viral_score || 0)}/100</span>
                  ${(a.metadata as any)?.views ? ` • Views: ${((a.metadata as any).views / 1000).toFixed(1)}K` : ''}
                </div>
                <a href="https://youtube.com/watch?v=${a.video_id}" style="color: #60a5fa; font-size: 12px;">Ver no YouTube →</a>
              </div>
            `).join('')}
          </div>
          <p style="font-size: 13px; color: #666;">
            💡 <strong>O que fazer:</strong> Analise esses vídeos e crie seu próprio conteúdo sobre o tema AGORA, antes que sature.
          </p>
          <a href="https://twentyseven-day-launchpad.lovable.app/scripts" 
             style="display: inline-block; background: #f97316; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">
            Criar Roteiro Agora →
          </a>
          <p style="font-size: 11px; color: #999; margin-top: 24px;">
            — Monetiza27 | Alertas pré-virais automáticos
          </p>
        </div>
      `;

      // Send email via Supabase Auth (or SMTP if configured)
      // For now, log the alert. In production, integrate with email service.
      console.log(`[VIRAL-ALERT] Sending to ${user.email}: ${subject}`);
      
      // Mark alerts as sent
      const alertIds = alerts.map(a => a.id);
      await sb.from("viral_alerts")
        .update({ sent_at: new Date().toISOString() })
        .in("id", alertIds);

      totalSent += alerts.length;
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-viral-alert error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
