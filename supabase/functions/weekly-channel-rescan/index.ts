import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not set");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 10;
    const forceRescan = body.force === true;

    // Get channels that haven't been analyzed in 7+ days (or all if forced)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    let query = sb
      .from("channel_intelligence")
      .select("id, channel_name, youtube_channel_id, niche, subscribers, avg_views, growth_rate, content_category, analyzed_at")
      .order("analyzed_at", { ascending: true, nullsFirst: true })
      .limit(batchSize);

    if (!forceRescan) {
      query = query.or(`analyzed_at.is.null,analyzed_at.lt.${cutoff}`);
    }

    const { data: channels, error: chErr } = await query;
    if (chErr) throw chErr;
    if (!channels?.length) {
      return new Response(JSON.stringify({ message: "No channels need rescanning", scanned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[WEEKLY-RESCAN] Processing ${channels.length} channels...`);

    const results: any[] = [];
    const alerts: any[] = [];

    for (const ch of channels) {
      try {
        // Fetch fresh YouTube data if we have the API key and channel ID
        let freshData: any = null;
        if (YOUTUBE_API_KEY && ch.youtube_channel_id) {
          const ytRes = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${ch.youtube_channel_id}&key=${YOUTUBE_API_KEY}`
          );
          if (ytRes.ok) {
            const ytJson = await ytRes.json();
            const item = ytJson.items?.[0];
            if (item) {
              freshData = {
                subscribers: parseInt(item.statistics.subscriberCount || "0"),
                views: parseInt(item.statistics.viewCount || "0"),
                videos: parseInt(item.statistics.videoCount || "0"),
              };
            }
          }
        }

        // Compare with previous data to detect changes
        const prevSubs = ch.subscribers || 0;
        const newSubs = freshData?.subscribers || prevSubs;
        const subsChange = prevSubs > 0 ? ((newSubs - prevSubs) / prevSubs) * 100 : 0;

        const prevViews = ch.avg_views || 0;

        // Detect decline
        if (subsChange < -10) {
          alerts.push({
            channel: ch.channel_name,
            type: "decline",
            message: `Subscribers dropped ${Math.abs(Math.round(subsChange))}% (${prevSubs} → ${newSubs})`,
            severity: subsChange < -20 ? "critical" : "warning",
          });
        }

        // Detect growth spike
        if (subsChange > 20) {
          alerts.push({
            channel: ch.channel_name,
            type: "growth",
            message: `Subscribers grew ${Math.round(subsChange)}% (${prevSubs} → ${newSubs})`,
            severity: "positive",
          });
        }

        // Use AI to analyze content_category if missing
        let newCategory = ch.content_category;
        if ((!newCategory || newCategory === "general") && GOOGLE_AI_API_KEY) {
          const aiRes = await fetch(AI_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: "Classify this YouTube channel into ONE category. Reply with ONLY the category name, nothing else. Categories: dark_storytelling, educational, entertainment, restoration, animal, documentary, true_crime, horror, mystery, science, technology, finance, gaming, cooking, travel, general",
                },
                {
                  role: "user",
                  content: `Channel: ${ch.channel_name}, Niche: ${ch.niche}, Growth: ${ch.growth_rate}`,
                },
              ],
            }),
          });
          if (aiRes.ok) {
            const aiJson = await aiRes.json();
            const cat = aiJson.choices?.[0]?.message?.content?.trim().toLowerCase();
            if (cat && cat.length < 30) newCategory = cat;
          }
        }

        // Update channel_intelligence
        const updateData: any = {
          analyzed_at: new Date().toISOString(),
        };
        if (freshData) {
          updateData.subscribers = freshData.subscribers;
          if (subsChange > 10) updateData.growth_rate = "explosive";
          else if (subsChange > 3) updateData.growth_rate = "fast";
          else if (subsChange > 0) updateData.growth_rate = "steady";
          else updateData.growth_rate = "declining";
        }
        if (newCategory && newCategory !== "general") {
          updateData.content_category = newCategory;
        }

        await sb.from("channel_intelligence").update(updateData).eq("id", ch.id);

        results.push({
          channel: ch.channel_name,
          subsChange: Math.round(subsChange),
          category: newCategory,
          updated: true,
        });
      } catch (e: any) {
        console.error(`[WEEKLY-RESCAN] Error on ${ch.channel_name}:`, e.message);
        results.push({ channel: ch.channel_name, error: e.message });
      }

      // Rate limit protection
      await new Promise((r) => setTimeout(r, 300));
    }

    // Log alerts to ai_learning for future reference
    if (alerts.length > 0) {
      await sb.from("ai_learning").insert(
        alerts.map((a) => ({
          topic: `channel_${a.type}`,
          source: "weekly-channel-rescan",
          insight: JSON.stringify(a),
        }))
      );
    }

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "weekly-channel-rescan",
      success: true,
      metadata: { scanned: results.length, alerts: alerts.length },
    });

    console.log(`[WEEKLY-RESCAN] Done. ${results.length} channels, ${alerts.length} alerts.`);

    return new Response(
      JSON.stringify({ scanned: results.length, alerts, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[WEEKLY-RESCAN] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
