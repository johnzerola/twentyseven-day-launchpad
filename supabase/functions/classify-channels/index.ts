import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { batchSize, reclassify } = await req.json().catch(() => ({ batchSize: 50, reclassify: false }));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // Get channels: unclassified ("general") OR reclassify all
    let query = sb.from("channel_intelligence")
      .select("id, channel_name, niche, style, is_faceless, country, language, top_videos, subscribers, avg_views, upload_frequency, sub_niche")
      .limit(Math.min(batchSize, 100));

    if (!reclassify) {
      query = query.eq("content_category", "general");
    }

    const { data: channels, error } = await query;

    if (error || !channels?.length) {
      return new Response(JSON.stringify({ success: true, classified: 0, message: "No channels to classify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalClassified = 0;
    const batchSz = 20;

    for (let i = 0; i < channels.length; i += batchSz) {
      const batch = channels.slice(i, i + batchSz);
      const prompt = `Classify each YouTube channel into ONE primary content_category AND assign a secondary_category if applicable.

## EXPANDED TAXONOMY (30 categories):

### Dark/Storytelling Cluster:
- dark_storytelling: faceless narration-based, dark/emotional topics
- true_crime_dark: true crime with dark aesthetic
- horror_dark: horror/paranormal faceless content
- mystery_conspiracy: conspiracy theories, unsolved mysteries, lost media
- urban_legends: creepypastas, urban legends, internet mysteries

### Documentary/Educational Cluster:
- documentary: documentary-style long-form content
- educational: science, history, explainers
- science_tech: deep science, space, physics, technology
- history_ancient: ancient history, civilizations, archaeology
- psychology_human: human behavior, psychology, social experiments

### Finance/Business Cluster:
- finance_dark: finance with dramatic storytelling
- crypto_web3: cryptocurrency, blockchain, web3
- business_case_study: business analysis, company stories, failures/successes
- real_estate: real estate investing, property tours

### Entertainment/Lifestyle Cluster:
- entertainment: challenges, comedy, lifestyle
- gaming_content: gaming walkthroughs, reviews, esports
- asmr_relaxation: ASMR, ambient sounds, relaxation
- reactions_commentary: reaction videos, social commentary
- compilations_clips: compilations, best-of clips, highlights

### Growth/Self-Improvement Cluster:
- motivational: motivation, self-improvement
- fitness_health: fitness, health, wellness
- productivity_hacks: productivity, life hacks, tools

### Visual/Creative Cluster:
- restoration: restoring objects, vehicles, buildings
- cooking_food: cooking, recipes, food content
- art_creative: art, DIY, creative processes
- travel_explore: travel, exploration, cultural content

### Nature/Animals Cluster:
- animal_content: animal rescue, wildlife, pets
- nature_survival: survival, nature, outdoor adventures

### Music/Audio Cluster:
- music_production: music creation, beats, covers
- ai_generated: AI-generated content, AI art, AI voices

### Catch-all:
- general: doesn't fit any above category

Channels:
${batch.map((ch: any, idx: number) => {
  const topVids = Array.isArray(ch.top_videos) ? ch.top_videos.slice(0, 3).map((v: any) => v.title || '').filter(Boolean).join(' | ') : '';
  return `${idx + 1}. "${ch.channel_name}" | niche: ${ch.niche} | sub_niche: ${ch.sub_niche || 'N/A'} | style: ${ch.style} | faceless: ${ch.is_faceless} | country: ${ch.country} | subs: ${ch.subscribers} | avg_views: ${ch.avg_views} | frequency: ${ch.upload_frequency || 'unknown'} | top videos: "${topVids}"`;
}).join('\n')}

Return ONLY a JSON array: [{"index": 1, "category": "dark_storytelling", "secondary": "mystery_conspiracy", "confidence": 0.92}, ...]
- "secondary" is optional (null if not applicable)
- "confidence" is 0.0-1.0`;

      try {
        const aiRes = await _ai({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are an expert YouTube channel classifier with deep knowledge of content niches. Respond ONLY in valid JSON array format. Be precise - choose the MOST specific category, not generic ones." },
              { role: "user", content: prompt },
            ],
          });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData.choices?.[0]?.message?.content || '[]';
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const classifications = JSON.parse(cleaned);

          for (const cl of classifications) {
            const idx = cl.index - 1;
            if (idx >= 0 && idx < batch.length && cl.category) {
              const updateData: any = { content_category: cl.category };
              if (cl.secondary) {
                updateData.visual_style_notes = `secondary_category:${cl.secondary}|confidence:${cl.confidence || 0.8}|${(batch[idx] as any).visual_style_notes || ''}`;
              }
              const { error: updErr } = await sb.from("channel_intelligence")
                .update(updateData)
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
      taxonomy_version: "v2_30cat",
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
