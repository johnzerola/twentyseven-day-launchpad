import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Migrated to Gemini Direct via _shared/gemini-direct.ts

function extractTranscript(xml: string): string {
  const textMatches = xml.match(/<text[^>]*>(.*?)<\/text>/gs);
  if (!textMatches) return "";
  return textMatches
    .map(m => m.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'))
    .join(' ')
    .slice(0, 12000);
}

async function fetchTranscript(videoId: string): Promise<string> {
  for (const lang of ['pt', 'en', 'es', 'de', 'pl']) {
    try {
      const res = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`);
      if (res.ok) {
        const xml = await res.text();
        const t = extractTranscript(xml);
        if (t) return t;
      } else {
        await res.text();
      }
    } catch { /* continue */ }
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { videoId, videoIds, mode = "single" } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ids = mode === "batch" && Array.isArray(videoIds) ? videoIds.slice(0, 5) : [videoId];
    if (!ids[0]) throw new Error("videoId or videoIds required");

    const results: any[] = [];

    for (const vid of ids) {
      try {
        // 1. Fetch video data + transcript
        const [vRes, transcript] = await Promise.all([
          fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${vid}&key=${YOUTUBE_API_KEY}`),
          fetchTranscript(vid),
        ]);
        const vData = await vRes.json();
        const video = vData.items?.[0];
        if (!video) { results.push({ videoId: vid, error: "not found" }); continue; }

        const views = parseInt(video.statistics.viewCount || '0');
        const title = video.snippet.title;
        const description = video.snippet.description?.slice(0, 500) || '';
        const tags = (video.snippet.tags || []).slice(0, 15).join(', ');

        // 2. AI NLP Analysis (replaces spaCy, HuggingFace, BERTopic)
        const aiRes = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: `You are an expert NLP and content analysis engine. Extract structured knowledge from YouTube videos. Respond ONLY via tool call.` },
              { role: "user", content: `Analyze this video for knowledge extraction:

TITLE: "${title}"
CHANNEL: "${video.snippet.channelTitle}"
VIEWS: ${views}
TAGS: ${tags}
DESCRIPTION: ${description}
${transcript ? `TRANSCRIPT (first 12K chars):\n${transcript}` : '(no transcript)'}

Extract:
1. EMOTIONS: dominant emotions throughout the content (with intensity 1-10)
2. ENTITIES: key named entities (people, brands, concepts, places)
3. NARRATIVE STRUCTURE: storytelling pattern used (Hero's Journey, PAS, Listicle, etc.)
4. TOPIC CLUSTERS: hidden sub-topics and related niches (like BERTopic would find)
5. LINGUISTIC PATTERNS: power words, rhetorical devices, sentence rhythm
6. HOOK ANALYSIS: opening technique and effectiveness
7. RETENTION TECHNIQUES: open loops, cliffhangers, pattern interrupts found
8. SEMANTIC KEYWORDS: terms for similarity matching (like FAISS embeddings)` }
            ],
            tools: [{
              type: "function",
              function: {
                name: "extract_knowledge",
                description: "Extract structured NLP knowledge from video content",
                parameters: {
                  type: "object",
                  properties: {
                    emotions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          emotion: { type: "string" },
                          intensity: { type: "number" },
                          context: { type: "string" }
                        },
                        required: ["emotion", "intensity", "context"],
                        additionalProperties: false
                      }
                    },
                    entities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          type: { type: "string", enum: ["person", "brand", "concept", "place", "event", "technique"] },
                          relevance: { type: "number" }
                        },
                        required: ["name", "type", "relevance"],
                        additionalProperties: false
                      }
                    },
                    narrativeStructure: {
                      type: "object",
                      properties: {
                        pattern: { type: "string" },
                        phases: { type: "array", items: { type: "string" } },
                        effectiveness: { type: "number" },
                        whyItWorks: { type: "string" }
                      },
                      required: ["pattern", "phases", "effectiveness", "whyItWorks"],
                      additionalProperties: false
                    },
                    topicClusters: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          topic: { type: "string" },
                          relatedNiches: { type: "array", items: { type: "string" } },
                          contentGap: { type: "boolean" },
                          searchVolume: { type: "string", enum: ["low", "medium", "high", "very_high"] }
                        },
                        required: ["topic", "relatedNiches", "contentGap", "searchVolume"],
                        additionalProperties: false
                      }
                    },
                    linguisticPatterns: {
                      type: "object",
                      properties: {
                        powerWords: { type: "array", items: { type: "string" } },
                        rhetoricalDevices: { type: "array", items: { type: "string" } },
                        sentenceRhythm: { type: "string" },
                        readabilityLevel: { type: "string" },
                        toneOfVoice: { type: "string" }
                      },
                      required: ["powerWords", "rhetoricalDevices", "sentenceRhythm", "readabilityLevel", "toneOfVoice"],
                      additionalProperties: false
                    },
                    hookAnalysis: {
                      type: "object",
                      properties: {
                        hookType: { type: "string" },
                        hookText: { type: "string" },
                        effectiveness: { type: "number" },
                        psychologicalTrigger: { type: "string" }
                      },
                      required: ["hookType", "hookText", "effectiveness", "psychologicalTrigger"],
                      additionalProperties: false
                    },
                    retentionTechniques: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          technique: { type: "string" },
                          description: { type: "string" },
                          estimatedImpact: { type: "number" }
                        },
                        required: ["technique", "description", "estimatedImpact"],
                        additionalProperties: false
                      }
                    },
                    semanticKeywords: {
                      type: "array",
                      items: { type: "string" },
                      description: "30-50 semantic keywords for similarity matching"
                    },
                    overallNiche: { type: "string" },
                    contentQualityScore: { type: "number" }
                  },
                  required: ["emotions", "entities", "narrativeStructure", "topicClusters", "linguisticPatterns", "hookAnalysis", "retentionTechniques", "semanticKeywords", "overallNiche", "contentQualityScore"],
                  additionalProperties: false
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "extract_knowledge" } }
          })
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error(`AI error for ${vid}:`, aiRes.status, errText);
          if (aiRes.status === 429) { results.push({ videoId: vid, error: "rate_limited" }); continue; }
          if (aiRes.status === 402) { results.push({ videoId: vid, error: "credits_exhausted" }); continue; }
          results.push({ videoId: vid, error: `ai_error_${aiRes.status}` }); continue;
        }

        const aiData = await aiRes.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) { results.push({ videoId: vid, error: "no_ai_response" }); continue; }
        const k = JSON.parse(toolCall.function.arguments);

        // 3. Store extracted knowledge in tables
        const inserts: Promise<any>[] = [];

        // 3a. Store narrative structure in script_knowledge
        if (k.narrativeStructure?.effectiveness >= 7) {
          inserts.push(sb.from("script_knowledge").insert({
            category: "narrative_structure",
            title: `${k.narrativeStructure.pattern} — "${title}"`,
            content: `Estrutura narrativa "${k.narrativeStructure.pattern}" com fases: ${k.narrativeStructure.phases.join(' → ')}. ${k.narrativeStructure.whyItWorks}. Extraída do vídeo "${title}" (${views.toLocaleString()} views).`,
            effectiveness_score: Math.round(k.narrativeStructure.effectiveness),
            examples: JSON.stringify([title])
          }));
        }

        // 3b. Store hook in script_knowledge
        if (k.hookAnalysis?.effectiveness >= 7) {
          inserts.push(sb.from("script_knowledge").insert({
            category: "hook",
            title: `Hook ${k.hookAnalysis.hookType} — "${title}"`,
            content: `"${k.hookAnalysis.hookText}". Gatilho: ${k.hookAnalysis.psychologicalTrigger}. Extraído de vídeo com ${views.toLocaleString()} views.`,
            effectiveness_score: Math.round(k.hookAnalysis.effectiveness),
            examples: JSON.stringify([k.hookAnalysis.hookText])
          }));
        }

        // 3c. Store retention techniques
        for (const rt of (k.retentionTechniques || []).filter((r: any) => r.estimatedImpact >= 7).slice(0, 3)) {
          inserts.push(sb.from("script_knowledge").insert({
            category: "retention_technique",
            title: `${rt.technique} — "${title}"`,
            content: `${rt.description}. Impacto estimado: ${rt.estimatedImpact}/10. Extraído de "${title}".`,
            effectiveness_score: Math.round(rt.estimatedImpact),
            examples: JSON.stringify([title])
          }));
        }

        // 3d. Store emotions as psychology patterns
        const dominantEmotions = (k.emotions || []).filter((e: any) => e.intensity >= 7);
        if (dominantEmotions.length) {
          inserts.push(sb.from("audience_psychology_patterns").insert({
            trigger_type: `emotion_${dominantEmotions[0].emotion.toLowerCase().replace(/\s+/g, '_')}`,
            description: `Emoções dominantes detectadas via NLP: ${dominantEmotions.map((e: any) => `${e.emotion} (${e.intensity}/10 — ${e.context})`).join('; ')}. Vídeo: "${title}" (${views.toLocaleString()} views).`,
            example_titles: [title],
            example_hooks: k.hookAnalysis?.hookText ? [k.hookAnalysis.hookText] : [],
            storytelling_pattern: k.narrativeStructure?.pattern || null,
            retention_score: Math.round(dominantEmotions[0].intensity),
            niches: [k.overallNiche],
            source: 'enrich-video-knowledge'
          }));
        }

        // 3e. Store topic clusters in viral_content_library
        const gapTopics = (k.topicClusters || []).filter((t: any) => t.contentGap);
        if (gapTopics.length) {
          inserts.push(sb.from("viral_content_library").insert({
            category: "topic_clusters",
            content_json: {
              source_video: title,
              source_channel: video.snippet.channelTitle,
              views,
              clusters: k.topicClusters,
              content_gaps: gapTopics.map((t: any) => ({ topic: t.topic, niches: t.relatedNiches, volume: t.searchVolume })),
              niche: k.overallNiche,
            },
            effectiveness_score: Math.min(10, Math.round(k.contentQualityScore)),
            language: "pt",
            niches: [k.overallNiche, ...gapTopics.flatMap((t: any) => t.relatedNiches).slice(0, 4)]
          }));
        }

        // 3f. Store linguistic patterns
        if (k.linguisticPatterns?.powerWords?.length >= 3) {
          inserts.push(sb.from("viral_content_library").insert({
            category: "linguistic_patterns",
            content_json: {
              source_video: title,
              power_words: k.linguisticPatterns.powerWords,
              rhetorical_devices: k.linguisticPatterns.rhetoricalDevices,
              sentence_rhythm: k.linguisticPatterns.sentenceRhythm,
              tone: k.linguisticPatterns.toneOfVoice,
              readability: k.linguisticPatterns.readabilityLevel,
              niche: k.overallNiche,
            },
            effectiveness_score: Math.min(10, Math.round(k.contentQualityScore)),
            language: "pt",
            niches: [k.overallNiche]
          }));
        }

        // 3g. Store semantic keywords for similarity matching
        if (k.semanticKeywords?.length >= 10) {
          inserts.push(sb.from("viral_content_library").insert({
            category: "semantic_index",
            content_json: {
              video_id: vid,
              video_title: title,
              channel: video.snippet.channelTitle,
              views,
              keywords: k.semanticKeywords,
              niche: k.overallNiche,
              quality_score: k.contentQualityScore,
            },
            effectiveness_score: Math.min(10, Math.round(k.contentQualityScore)),
            language: "pt",
            niches: [k.overallNiche]
          }));
        }

        // 3h. Store high-performing title in viral_titles_db
        if (views >= 200000) {
          inserts.push(sb.from("viral_titles_db").insert({
            title,
            channel_name: video.snippet.channelTitle,
            channel_id: video.snippet.channelId,
            views,
            likes: parseInt(video.statistics.likeCount || '0'),
            niche: k.overallNiche,
            why_viral: k.hookAnalysis?.psychologicalTrigger || null,
            title_pattern: k.narrativeStructure?.pattern || null,
            emotional_triggers: dominantEmotions.map((e: any) => e.emotion),
            published_at: video.snippet.publishedAt,
            duration_seconds: (() => {
              const d = video.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
              return d ? (parseInt(d[1]||'0')*3600 + parseInt(d[2]||'0')*60 + parseInt(d[3]||'0')) : 0;
            })(),
          }).then(() => {}).catch(() => {}));
        }

        await Promise.allSettled(inserts);
        console.log(`Enriched: "${title}" → ${inserts.length} knowledge entries`);

        results.push({
          videoId: vid,
          title,
          views,
          niche: k.overallNiche,
          qualityScore: k.contentQualityScore,
          knowledgeInserted: inserts.length,
          emotions: dominantEmotions.map((e: any) => e.emotion),
          narrativePattern: k.narrativeStructure?.pattern,
          topicGaps: gapTopics.length,
          hookType: k.hookAnalysis?.hookType,
        });
      } catch (vidErr) {
        console.error(`Error enriching ${vid}:`, vidErr);
        results.push({ videoId: vid, error: vidErr instanceof Error ? vidErr.message : "unknown" });
      }
    }

    return new Response(JSON.stringify({ results, totalEnriched: results.filter(r => !r.error).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("enrich-video-knowledge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
