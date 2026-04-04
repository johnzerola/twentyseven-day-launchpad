import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ═══════════════════════════════════════════════════════════
// CHANNEL VOICE LEARNING
// Analyzes user's previous scripts to learn their unique tone
// Creates a "voice signature" injected into future generations
// ═══════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, channelId } = await req.json();
    if (!userId) throw new Error("userId required");

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch user's saved scripts (most recent, best performing first)
    const { data: scripts } = await sb.from("saved_scripts")
      .select("script_content, topic, style, video_type, duration")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!scripts?.length || scripts.length < 3) {
      return new Response(JSON.stringify({
        success: false,
        message: "Need at least 3 saved scripts to learn your voice. Keep creating!",
        scripts_found: scripts?.length || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Statistical analysis of writing style
    const allContent = scripts.map(s => s.script_content || '').join('\n');
    const sentences = allContent.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const words = allContent.split(/\s+/).filter(w => w.length > 0);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));

    const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 15;
    const vocabularyRichness = words.length > 0 ? uniqueWords.size / words.length : 0.5;

    // Extract samples for AI analysis (2000 chars from each of top 5 scripts)
    const samples = scripts.slice(0, 5).map((s, i) =>
      `--- Script ${i + 1} (${s.style || 'unknown'}, ${s.topic?.slice(0, 50)}) ---\n${(s.script_content || '').slice(0, 2000)}`
    ).join('\n\n');

    const aiRes = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: `Analyze these 5 script samples from the SAME creator and extract their unique writing "voice DNA".

${samples}

Return JSON with:
{
  "voice_signature": {
    "tone": "description of overall tone (e.g., 'irreverent, sarcastic with sudden moments of sincerity')",
    "rhythm": "sentence rhythm pattern (e.g., 'alternates between 3-word punches and long flowing descriptions')",
    "vocabulary_level": "simple/intermediate/advanced/mixed",
    "humor_style": "type of humor if any (e.g., 'self-deprecating, dark, absurdist')",
    "emotional_range": "what emotions they express and how (e.g., 'controlled anger that builds to explosive revelations')",
    "signature_phrases": ["recurring phrases or structures they naturally use"],
    "narrative_preference": "how they structure stories (e.g., 'starts with conclusion, backtracks to explain')",
    "audience_relationship": "how they address viewers (e.g., 'conspiratorial tone, as if sharing a secret')"
  },
  "tone_keywords": ["5-10 keywords that define this voice"],
  "style_markers": ["specific stylistic elements to reproduce"],
  "voice_prompt_injection": "A 150-word prompt that, when injected into a script generator, will make the output sound like THIS specific creator. Be very specific about word choices, rhythm, tone shifts, and structural habits."
}`
        }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) throw new Error(`AI analysis failed: ${aiRes.status}`);

    const aiData = await aiRes.json();
    let voiceProfile;
    try {
      voiceProfile = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');
    } catch {
      throw new Error("Failed to parse voice profile");
    }

    // Save voice profile
    await sb.from("channel_voice_profiles").upsert({
      user_id: userId,
      channel_id: channelId || null,
      voice_signature: voiceProfile.voice_signature || {},
      tone_keywords: voiceProfile.tone_keywords || [],
      avg_sentence_length: Math.round(avgSentenceLength * 10) / 10,
      vocabulary_richness: Math.round(vocabularyRichness * 1000) / 1000,
      style_markers: voiceProfile.style_markers || [],
      sample_scripts_analyzed: scripts.length,
      last_analyzed_at: new Date().toISOString(),
    }, { onConflict: "user_id,channel_id" });

    await sb.from("execution_logs").insert({
      function_name: "learn-channel-voice",
      success: true,
      api_calls_made: 1,
      metadata: {
        scripts_analyzed: scripts.length,
        avg_sentence_length: avgSentenceLength,
        vocabulary_richness: vocabularyRichness,
        tone_keywords: voiceProfile.tone_keywords,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      voice_profile: voiceProfile,
      stats: {
        scripts_analyzed: scripts.length,
        avg_sentence_length: Math.round(avgSentenceLength),
        vocabulary_richness: Math.round(vocabularyRichness * 100) + '%',
        unique_words: uniqueWords.size,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("learn-channel-voice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
