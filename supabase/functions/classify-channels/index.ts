import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { batchSize } = await req.json().catch(() => ({ batchSize: 50 }));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get channels that are still "general"
    const { data: channels, error } = await sb.from("channel_intelligence")
      .select("id, channel_name, niche, style, is_faceless, country, language, top_videos")
      .eq("content_category", "general")
      .limit(Math.min(batchSize, 100));

    if (error || !channels?.length) {
      return new Response(JSON.stringify({ success: true, classified: 0, message: "No channels to classify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Classify in batches of 20 via AI
    let totalClassified = 0;
    const batchSz = 20;

    for (let i = 0; i < channels.length; i += batchSz) {
      const batch = channels.slice(i, i + batchSz);
      const prompt = `Classify each YouTube channel into ONE content_category.

Categories:
- dark_storytelling: faceless, narration-based, dark/emotional topics, no face shown
- true_crime_dark: true crime with dark aesthetic
- horror_dark: horror/paranormal faceless content
- restoration: restoring objects, vehicles, buildings
- animal_content: animal rescue, wildlife, pets
- educational: science, history, explainers
- entertainment: challenges, comedy, lifestyle
- motivational: motivation, self-improvement
- finance_dark: finance with dramatic storytelling
- documentary: documentary-style content
- general: doesn't fit above categories

Channels:
${batch.map((ch: any, idx: number) => {
  const topVid = Array.isArray(ch.top_videos) ? ch.top_videos[0]?.title || '' : '';
  return `${idx + 1}. "${ch.channel_name}" | niche: ${ch.niche} | style: ${ch.style} | faceless: ${ch.is_faceless} | country: ${ch.country} | top video: "${topVid}"`;
}).join('\n')}

Return ONLY a JSON array with objects: [{"index": 1, "category": "dark_storytelling"}, ...]`;

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "You are a YouTube channel classifier. Respond ONLY in valid JSON array format." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData.choices?.[0]?.message?.content || '[]';
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const classifications = JSON.parse(cleaned);

          for (const cl of classifications) {
            const idx = cl.index - 1;
            if (idx >= 0 && idx < batch.length && cl.category) {
              const { error: updErr } = await sb.from("channel_intelligence")
                .update({ content_category: cl.category })
                .eq("id", batch[idx].id);
              if (!updErr) totalClassified++;
            }
          }
        }
      } catch (e) { console.warn(`Classification batch ${i} failed:`, e); }
    }

    return new Response(JSON.stringify({
      success: true,
      classified: totalClassified,
      total: channels.length,
      remaining: Math.max(0, channels.length - totalClassified),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("classify-channels error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
