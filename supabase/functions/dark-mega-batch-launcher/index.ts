import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 78 dark mega categories
const DARK_CATEGORIES = [
  // True Crime & Mystery
  "true crime faceless 1M+", "unsolved mysteries faceless 1M+", "cold case investigation 1M+",
  "serial killer documentary faceless 1M+", "forensic science faceless 1M+", "heist stories faceless 1M+",
  "prison stories faceless 1M+", "missing persons cases 1M+",
  // Horror & Paranormal
  "creepypasta horror narration 1M+", "paranormal investigation faceless 1M+",
  "haunted places documentary 1M+", "urban legends narration 1M+", "SCP foundation faceless 1M+",
  "ghost stories narration 1M+", "scary stories compilation 1M+",
  // Dark History
  "dark history faceless 1M+", "ancient civilizations documentary 1M+", "war stories documentary 1M+",
  "medieval history faceless 1M+", "viking history faceless 1M+", "samurai warrior stories 1M+",
  "Roman empire documentary 1M+", "World War stories faceless 1M+", "cult documentary faceless 1M+",
  // Animal & Nature
  "animal rescue stories faceless 1M+", "wildlife predators documentary 1M+",
  "ocean creatures documentary 1M+", "insect world faceless 1M+", "animal facts compilation 1M+",
  "nature survival documentary 1M+", "deep sea creatures faceless 1M+",
  "animal behavior explained 1M+", "endangered species documentary 1M+",
  // Curiosities & Facts
  "curiosidades faceless 1M+", "did you know facts faceless 1M+",
  "mind blowing facts compilation 1M+", "world records faceless 1M+",
  "comparison videos faceless 1M+", "top 10 facts faceless 1M+",
  // ASMR & Relaxation
  "ASMR relaxation faceless 1M+", "sleep stories narration 1M+",
  "ambient sounds nature 1M+", "rain sounds sleep 1M+", "meditation guided faceless 1M+",
  "lo-fi ambient faceless 1M+", "white noise sleep 1M+",
  // Science & Space
  "space exploration faceless 1M+", "quantum physics explained 1M+",
  "astronomy documentary faceless 1M+", "science experiments faceless 1M+",
  "AI technology documentary 1M+", "future technology faceless 1M+",
  "volcano earthquake documentary 1M+", "weather phenomena faceless 1M+",
  // Psychology & Philosophy
  "dark psychology faceless 1M+", "manipulation tactics faceless 1M+",
  "body language analysis faceless 1M+", "stoicism philosophy faceless 1M+",
  "human behavior explained 1M+", "cognitive biases explained 1M+",
  // Mythology & Folklore
  "mythology Norse gods faceless 1M+", "mythology Greek heroes faceless 1M+",
  "mythology Egyptian ancient 1M+", "mythology Japanese yokai 1M+",
  "folklore fairy tales dark 1M+", "legend stories narration 1M+",
  // Medical & Survival
  "medical mysteries faceless 1M+", "surgery explained faceless 1M+",
  "survival stories narration 1M+", "disaster documentary faceless 1M+",
  "aviation disasters faceless 1M+", "shipwreck stories faceless 1M+",
  // Restoration & Satisfying
  "restoration videos faceless 1M+", "satisfying videos compilation 1M+",
  "cleaning transformation faceless 1M+",
  // Non-EN Dark Mega
  "true crime faceless português 1M+", "curiosidades faceless español 1M+",
  "horror narration français 1M+", "dark history deutsch 1M+",
  "misteri italiano faceless 1M+", "true crime Hindi faceless 1M+",
  "horror stories Japanese 1M+", "mystery Korean faceless 1M+",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 4; // nichos por onda
    const startIndex = body.startIndex || 0;
    const delayBetweenMs = body.delayBetweenMs || 8000;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const endIndex = Math.min(startIndex + batchSize, DARK_CATEGORIES.length);
    const batchNiches = DARK_CATEGORIES.slice(startIndex, endIndex);

    if (batchNiches.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "All 78 categories processed",
        total_categories: DARK_CATEGORIES.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[DARK-MEGA] Batch ${startIndex}-${endIndex} of ${DARK_CATEGORIES.length}: ${batchNiches.join(', ')}`);

    // Dispatch to discover-channels-gemini
    const resp = await fetch(`${supabaseUrl}/functions/v1/discover-channels-gemini`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "dark_mega",
        niches: batchNiches,
        maxNiches: batchNiches.length,
        verifyWithYouTube: false,
      }),
    });

    const result = await resp.json().catch(() => ({ error: "parse failed" }));

    // Schedule next batch if there are more
    const nextIndex = endIndex;
    let nextScheduled = false;
    if (nextIndex < DARK_CATEGORIES.length) {
      // Self-invoke for next batch after delay
      setTimeout(async () => {
        try {
          await fetch(`${supabaseUrl}/functions/v1/dark-mega-batch-launcher`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ startIndex: nextIndex, batchSize, delayBetweenMs }),
          });
        } catch (e) {
          console.error("[DARK-MEGA] Failed to schedule next batch:", e);
        }
      }, delayBetweenMs);
      nextScheduled = true;
    }

    return new Response(JSON.stringify({
      success: resp.ok,
      batch: `${startIndex}-${endIndex}`,
      niches_in_batch: batchNiches.length,
      remaining: DARK_CATEGORIES.length - endIndex,
      next_scheduled: nextScheduled,
      result,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[DARK-MEGA] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
