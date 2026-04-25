import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY") || "";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
// Migrated to Gemini Direct via _shared/gemini-direct.ts

// ── Default curated channels ──
const DEFAULT_CHANNELS = [
  // ── Restoration ──
  { url: "@mrsklaragarage", category: "restoration" },
  { url: "@Restoration-Factory", category: "restoration" },
  { url: "@kamilbusiness-22", category: "restoration" },
  // ── Movies/Cinema ──
  { url: "@stash_movies", category: "movies" },
  { url: "@Filmaxia", category: "movies" },
  // ── Animal Stories ──
  { url: "@VeteranDogTales", category: "animal_stories" },
  // ── Western Stories ──
  { url: "@SilentWestTales", category: "western_stories" },
  { url: "@Dusty_Boots", category: "western_stories" },
  { url: "@CowboyStoryStation", category: "western_stories" },
  { url: "@StoriesoftheCountryside-Us", category: "western_stories" },
  { url: "@RomancesoftheOldWest", category: "western_stories" },
  { url: "@BobsStoriesFromtheOldWest", category: "western_stories" },
  { url: "@HorsebackChronicles-p3h", category: "western_stories" },
  { url: "@HeartOfThePrairie", category: "western_stories" },
  // ── Survival Stories ──
  { url: "@TheFindersTale", category: "survival_stories" },
  { url: "@Outlanderssurvivalstories", category: "survival_stories" },
  { url: "@ForgottenOutlandsTeachings", category: "survival_stories" },
  { url: "@simplesurvival6", category: "survival_stories" },
  { url: "@MoutainFarmerStories", category: "survival_stories" },
  // ── Inspirational ──
  { url: "@DreamsDontAge", category: "inspirational" },
  { url: "@GrandmaTrueStories", category: "inspirational" },
  { url: "@EverydayValorStories-o3t", category: "inspirational" },
  { url: "@SoulStories02", category: "inspirational" },
  // ── Drama Stories ──
  { url: "@HEARTBREAK-STORIES-CHANNEL", category: "drama_stories" },
  { url: "@IntoThePastStories", category: "drama_stories" },
  { url: "@LoganStories", category: "drama_stories" },
  // ── True Crime ──
  { url: "@48HourTrueCrime01", category: "true_crime" },
  { url: "@StoriesoftheMıssıng-HO", category: "true_crime" },
  { url: "@UNSOLVEDSTORIES-q9d", category: "true_crime" },
  { url: "@TrueCrimeDarkBonds", category: "true_crime" },
  { url: "@TrueCrimeBreakdown1", category: "true_crime" },
  { url: "@TajnéPřípady", category: "true_crime" },
  { url: "@ScaryInteresting", category: "true_crime" },
  // ── Stories (ID-based) ──
  { url: "channel/UCHL5AxOuChnnkXAzW4E5hgQ", category: "stories" },
  { url: "channel/UCqxEDM4DwBKgSkJc6zK-Dvw", category: "stories" },
  { url: "channel/UCEny9ly3uAew5ZasV3tXL7A", category: "stories" },

  // ═══════════════════════════════════════════════
  // ── NEW: Expanded Viral Faceless Channels v3.0 ──
  // ═══════════════════════════════════════════════

  // ── Pets & Animals ──
  { url: "@TheDodo", category: "pets" },
  { url: "@ViralPaws", category: "pets" },
  { url: "@HeroicAnimals", category: "pets" },
  { url: "@FunnyAnimals", category: "pets" },
  { url: "@AnimalRescueStories", category: "pets" },
  { url: "@CatPurrs", category: "pets" },
  { url: "@PawsOfWar", category: "pets" },
  { url: "@WildAnimalWorld", category: "pets" },

  // ── Travel & Geography ──
  { url: "@GeographyNow", category: "travel" },
  { url: "@WondersOfTheWorld", category: "travel" },
  { url: "@TopLuxury", category: "travel" },
  { url: "@HighSideTravel", category: "travel" },
  { url: "@PlacesAndFoods", category: "travel" },
  { url: "@ExploringAbandoned", category: "travel" },
  { url: "@TheMysteriousWorld", category: "travel" },

  // ── Philosophy & Psychology ──
  { url: "@Einzelganger", category: "philosophy" },
  { url: "@PhilosophiesForLife", category: "philosophy" },
  { url: "@Pursuit_of_Wonder", category: "philosophy" },
  { url: "@TheSchoolOfLife", category: "philosophy" },
  { url: "@AfterSkool", category: "philosophy" },
  { url: "@FreeWillChannel", category: "philosophy" },
  { url: "@MindfulThoughts", category: "philosophy" },

  // ── Health & Fitness ──
  { url: "@GravityTransformation", category: "health" },
  { url: "@BullyJuice", category: "health" },
  { url: "@Body_Hub", category: "health" },
  { url: "@TheSeriousFitness", category: "health" },
  { url: "@NutritionFactsOrg", category: "health" },

  // ── Curiosidades / Facts (PT-BR) ──
  { url: "@Fatos_Desconhecidos", category: "curiosidades" },
  { url: "@CanalNostalgia", category: "curiosidades" },
  { url: "@Ponto_em_Comum", category: "curiosidades" },
  { url: "@Incrivel.club", category: "curiosidades" },
  { url: "@FatosDesconhecidosX", category: "curiosidades" },
  { url: "@Top10Archive", category: "curiosidades" },
  { url: "@BEAmazed", category: "curiosidades" },
  { url: "@BrightSide", category: "curiosidades" },

  // ── História / History ──
  { url: "@KingsAndGenerals", category: "history" },
  { url: "@OverSimplified", category: "history" },
  { url: "@Knowledgia", category: "history" },
  { url: "@HistoryMarche", category: "history" },
  { url: "@ToldInStone", category: "history" },
  { url: "@InvictusMen", category: "history" },
  { url: "@HistoryLegends", category: "history" },
  { url: "@TheHistorian_scraft", category: "history" },

  // ── Horror & Creepypasta ──
  { url: "@MrNightmare", category: "horror" },
  { url: "@LazyMasquerade", category: "horror" },
  { url: "@MrBallen", category: "horror" },
  { url: "@NukesTop5", category: "horror" },
  { url: "@Chills", category: "horror" },
  { url: "@CreepsMcPasta", category: "horror" },
  { url: "@DarkCornerTv", category: "horror" },

  // ── Finanças / Finance ──
  { url: "@GrahamStephan", category: "finance" },
  { url: "@MoneyGuyShow", category: "finance" },
  { url: "@HowMoneyWorks", category: "finance" },
  { url: "@TwoTeachMoney", category: "finance" },
  { url: "@WhiteboardFinance", category: "finance" },
  { url: "@PlainBagel", category: "finance" },

  // ── Gaming ──
  { url: "@GameTheory", category: "gaming" },
  { url: "@Outside_Xbox", category: "gaming" },
  { url: "@GamingBolt", category: "gaming" },
  { url: "@Top10Gaming", category: "gaming" },
  { url: "@WatchMojo", category: "gaming" },
  { url: "@Looper", category: "gaming" },

  // ── Psychology & Self-Improvement ──
  { url: "@BetterThanYesterday", category: "psychology" },
  { url: "@WisdomMotivation", category: "psychology" },
  { url: "@MotivazioneItaliana", category: "psychology" },
  { url: "@MotivationHub", category: "psychology" },
  { url: "@AluxOfficial", category: "psychology" },
  { url: "@TopThink", category: "psychology" },

  // ── Mythology & Legends ──
  { url: "@MythologyExplained", category: "mythology" },
  { url: "@SeeUinHistory", category: "mythology" },
  { url: "@MiscellaneaMythology", category: "mythology" },
  { url: "@GrecianGodx", category: "mythology" },
  { url: "@MythicalCreature", category: "mythology" },
  { url: "@Mythology_Unleashed", category: "mythology" },
  { url: "@TheAmbivert", category: "mythology" },

  // ── Luxury & Billionaires ──
  { url: "@LuxuryZone", category: "luxury" },
  { url: "@OldMoney_Luxury", category: "luxury" },
  { url: "@TopLuxuryLife", category: "luxury" },
  { url: "@BillionaireLifestyle", category: "luxury" },
  { url: "@MillionairePost", category: "luxury" },

  // ── Cars & Automotive ──
  { url: "@Supercar_Blondie", category: "cars" },
  { url: "@CarWow", category: "cars" },
  { url: "@MatDoes", category: "cars" },
  { url: "@AutoTopNL", category: "cars" },
  { url: "@TheStraightPipes", category: "cars" },

  // ── Space & Science ──
  { url: "@Kurzgesagt", category: "space" },
  { url: "@RealLifeLore", category: "space" },
  { url: "@SpaceExploration", category: "space" },
  { url: "@Astrum", category: "space" },
  { url: "@SEA_Official", category: "space" },
  { url: "@CosmicDiscovery", category: "space" },
  { url: "@Ridddle", category: "space" },

  // ── DIY & Crafts ──
  { url: "@5MinuteCrafts", category: "diy" },
  { url: "@TROOM_TROOM", category: "diy" },
  { url: "@HackSmith", category: "diy" },
  { url: "@DIYPerks", category: "diy" },

  // ── Conspiracy & Mysteries ──
  { url: "@Lemmino", category: "mysteries" },
  { url: "@LightHouseStories", category: "mysteries" },
  { url: "@BuzzFeedUnsolved", category: "mysteries" },
  { url: "@MysteriousMiddleEast", category: "mysteries" },
  { url: "@BlameItOnJorge", category: "mysteries" },
  { url: "@FellowsFilmTV", category: "mysteries" },

  // ── Technology & AI ──
  { url: "@Mrwhosetheboss", category: "technology" },
  { url: "@TechLinked", category: "technology" },
  { url: "@ColdFusion", category: "technology" },
  { url: "@PolyMatter", category: "technology" },
  { url: "@TwoMinutePapers", category: "technology" },

  // ── Cooking & Food (Faceless) ──
  { url: "@BabishCulinaryUniverse", category: "cooking" },
  { url: "@SortedFood", category: "cooking" },
  { url: "@ProHomeCooks", category: "cooking" },
  { url: "@EpicMealTime", category: "cooking" },

  // ── Compilation & Reddit Stories ──
  { url: "@rSlash", category: "reddit_stories" },
  { url: "@EmKay", category: "reddit_stories" },
  { url: "@DarkFluff", category: "reddit_stories" },
  { url: "@StorytimeReddit", category: "reddit_stories" },
  { url: "@AskRedditStories-j7v", category: "reddit_stories" },

  // ── Education & Explainers ──
  { url: "@Veritasium", category: "education" },
  { url: "@TedEd", category: "education" },
  { url: "@Vsauce", category: "education" },
  { url: "@MinuteEarth", category: "education" },
  { url: "@SmarterEveryDay", category: "education" },

  // ── Nature & Wildlife ──
  { url: "@NatGeoWild", category: "nature" },
  { url: "@AnnacondaAttack", category: "nature" },
  { url: "@WildCreatures", category: "nature" },
  { url: "@TheJungleExplorer", category: "nature" },

  // ── Relationship & Social ──
  { url: "@JarvisJohnson", category: "relationships" },
  { url: "@PsychologyMind", category: "relationships" },
  { url: "@CharlieHoupert", category: "relationships" },
  { url: "@BetterIdeas", category: "relationships" },

  // ── PT-BR Faceless Channels ──
  { url: "@HistoriaMundi", category: "history_ptbr" },
  { url: "@QuebrandoOTabu", category: "curiosidades_ptbr" },
  { url: "@Ciencia_Todo_Dia", category: "science_ptbr" },
  { url: "@VisualPolitikBR", category: "politics_ptbr" },
  { url: "@NerdologiaTech", category: "tech_ptbr" },
  { url: "@OFilosofoPop", category: "philosophy_ptbr" },
  { url: "@MetaForando", category: "psychology_ptbr" },
  { url: "@MundoDesconhecido", category: "mysteries_ptbr" },

  // ── Spanish Faceless Channels ──
  { url: "@CuriosamenteChannel", category: "curiosidades_es" },
  { url: "@LaHiperactina", category: "science_es" },
  { url: "@QuantumFracture", category: "science_es" },
  { url: "@TeDijoNoSabias", category: "facts_es" },
  { url: "@DrossRotzank", category: "horror_es" },
];

function getYouTubeKeys(): string[] {
  return [
    Deno.env.get("YOUTUBE_API_KEY"),
    Deno.env.get("YOUTUBE_API_KEY_2"),
    Deno.env.get("YOUTUBE_API_KEY_3"),
    Deno.env.get("YOUTUBE_API_KEY_4"),
  ].filter(Boolean) as string[];
}

let currentKeyIndex = 0;

async function ytFetch(endpoint: string, keys: string[]): Promise<any> {
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (currentKeyIndex + attempt) % keys.length;
    const key = keys[idx];
    const sep = endpoint.includes("?") ? "&" : "?";
    const res = await fetch(`${YOUTUBE_API_BASE}/${endpoint}${sep}key=${key}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && !data?.error) {
      currentKeyIndex = idx;
      return data;
    }
    const reason = data?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "rateLimitExceeded" || res.status === 429) {
      console.log(`Key ${idx} quota exceeded, rotating...`);
      continue;
    }
    throw new Error(data?.error?.message || `YouTube ${res.status}`);
  }
  throw new Error("All YouTube API keys exhausted");
}

function parseChannelInput(input: string): string {
  // Extract handle or channel ID from various URL formats
  let cleaned = input.trim().replace(/\/videos\/?$/, "").replace(/\/$/, "");
  
  // Full URL: https://www.youtube.com/@handle or /channel/UC...
  const handleMatch = cleaned.match(/youtube\.com\/@([^\/\?]+)/);
  if (handleMatch) return `@${handleMatch[1]}`;
  
  const channelMatch = cleaned.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channelMatch) return `channel/${channelMatch[1]}`;
  
  // Already a handle or channel ID
  if (cleaned.startsWith("@") || cleaned.startsWith("channel/")) return cleaned;
  if (cleaned.startsWith("UC") && cleaned.length > 20) return `channel/${cleaned}`;
  
  // Assume it's a handle
  return `@${cleaned}`;
}

async function resolveChannelId(input: string, keys: string[]): Promise<string> {
  const cidMatch = input.match(/channel\/(UC[\w-]+)/);
  if (cidMatch) return cidMatch[1];

  const handle = input.replace(/^@/, "").replace(/\/videos$/, "");
  const data = await ytFetch(`channels?part=id&forHandle=${encodeURIComponent(handle)}`, keys);
  if (data?.items?.[0]?.id) return data.items[0].id;

  const search = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1`, keys);
  if (search?.items?.[0]?.snippet?.channelId) return search.items[0].snippet.channelId;

  throw new Error(`Cannot resolve: ${input}`);
}

async function aiAnalyze(prompt: string, apiKey: string, tool: any): Promise<any> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a YouTube content intelligence analyst specializing in faceless/AI-generated long-form video channels. Analyze with precision. Always respond via the tool call." },
        { role: "user", content: prompt.slice(0, 8000) },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) { await new Promise(r => setTimeout(r, 5000)); throw new Error("rate_limited"); }
    throw new Error(`AI ${res.status}`);
  }
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call returned");
  return JSON.parse(tc.function.arguments);
}

const CHANNEL_DEEP_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_veo3_channel",
    description: "Deep analysis of a YouTube channel for content replication",
    parameters: {
      type: "object",
      properties: {
        niche: { type: "string" },
        sub_niche: { type: "string" },
        language: { type: "string" },
        country: { type: "string" },
        style: { type: "string" },
        is_faceless: { type: "boolean" },
        is_veo3_style: { type: "boolean" },
        visual_style_notes: { type: "string" },
        content_model: { type: "string", enum: ["storytelling", "documentary", "mystery", "drama", "restoration", "compilation", "educational", "emotional"] },
        avg_video_duration_min: { type: "number" },
        hook_patterns: { type: "array", items: { type: "string" } },
        title_formulas: { type: "array", items: { type: "string" } },
        narrative_structure: { type: "string" },
        scene_types: { type: "array", items: { type: "string" } },
        camera_techniques: { type: "array", items: { type: "string" } },
        music_style: { type: "string" },
        pacing: { type: "string", enum: ["slow", "medium", "fast", "variable"] },
        emotion_primary: { type: "string" },
        psychological_triggers: { type: "array", items: { type: "string" } },
        why_successful: { type: "string" },
        replication_guide_pt: { type: "string" },
        replication_guide_en: { type: "string" },
        best_markets: { type: "array", items: { type: "string" } },
        estimated_rpm: { type: "number" },
        growth_rate: { type: "string", enum: ["explosive", "fast", "steady", "slow"] },
        top_video_patterns: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, views: { type: "number" }, why_viral: { type: "string" }, hook_text: { type: "string" } },
            required: ["title", "views", "why_viral"],
          },
        },
        seo_strategy: { type: "string", description: "SEO strategy used: tags, descriptions, keywords" },
        first_10s_hook_style: { type: "string", description: "How the first 10 seconds hook viewers" },
        script_writing_guide: { type: "string", description: "Step-by-step guide to write scripts like this channel" },
        scene_prompt_templates: { type: "array", items: { type: "string" }, description: "5 reusable scene prompt templates based on this channel" },
        ideal_video_ideas: { type: "array", items: { type: "string" }, description: "10 video ideas that would work for this niche" },
      },
      required: ["niche", "sub_niche", "language", "country", "style", "is_faceless", "is_veo3_style", "visual_style_notes", "content_model", "hook_patterns", "title_formulas", "narrative_structure", "scene_types", "camera_techniques", "pacing", "emotion_primary", "psychological_triggers", "why_successful", "replication_guide_pt", "best_markets", "seo_strategy", "first_10s_hook_style", "script_writing_guide", "scene_prompt_templates", "ideal_video_ideas"],
      additionalProperties: false,
    },
  },
};

async function processChannel(ch: { url: string; category: string }, ytKeys: string[], apiKey: string, sb: any): Promise<any> {
  const label = ch.url;
  console.log(`Processing ${label}...`);

  const channelId = await resolveChannelId(ch.url, ytKeys);
  const chData = await ytFetch(`channels?part=snippet,statistics,contentDetails&id=${channelId}`, ytKeys);
  const channel = chData.items?.[0];
  if (!channel) throw new Error(`${label}: not found`);

  const subs = parseInt(channel.statistics.subscriberCount || "0");
  const totalViews = parseInt(channel.statistics.viewCount || "0");

  // Get top videos
  const topSearch = await ytFetch(`search?part=snippet&channelId=${channelId}&order=viewCount&maxResults=15&type=video`, ytKeys);
  const topIds = (topSearch.items || []).map((i: any) => i.id.videoId).filter(Boolean);

  let topVideos: any[] = [];
  if (topIds.length) {
    const vData = await ytFetch(`videos?part=snippet,statistics,contentDetails&id=${topIds.join(",")}`, ytKeys);
    topVideos = (vData.items || []).map((v: any) => {
      const views = parseInt(v.statistics?.viewCount || "0");
      const likes = parseInt(v.statistics?.likeCount || "0");
      const dMatch = (v.contentDetails?.duration || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const dSec = dMatch ? (parseInt(dMatch[1] || "0") * 3600 + parseInt(dMatch[2] || "0") * 60 + parseInt(dMatch[3] || "0")) : 0;
      return {
        video_id: v.id,
        title: v.snippet.title,
        views,
        likes,
        duration_seconds: dSec,
        description: (v.snippet.description || "").slice(0, 300),
        published_at: v.snippet.publishedAt,
        tags: (v.snippet.tags || []).slice(0, 10),
      };
    }).sort((a: any, b: any) => b.views - a.views);
  }

  const avgViews = topVideos.length ? Math.round(topVideos.reduce((s: number, v: any) => s + v.views, 0) / topVideos.length) : 0;

  // AI Deep Analysis
  const prompt = `Analyze this YouTube channel deeply for content replication:

CHANNEL: "${channel.snippet.title}"
Subscribers: ${subs.toLocaleString()}
Total views: ${totalViews.toLocaleString()}
Category: ${ch.category}
Description: "${(channel.snippet.description || "").slice(0, 500)}"
Country: ${channel.snippet.country || "Unknown"}

TOP ${topVideos.length} VIDEOS:
${topVideos.slice(0, 12).map((v: any, i: number) => `${i + 1}. "${v.title}" — ${v.views.toLocaleString()} views, ${Math.round(v.duration_seconds / 60)}min, tags: ${v.tags.slice(0, 5).join(", ")}`).join("\n")}

Analyze deeply:
1. Visual style, camera movements, scene types
2. Narrative structure and pacing
3. Hook patterns (especially first 10 seconds) and title formulas
4. SEO strategy (tags, descriptions, keywords)
5. Why this content goes viral
6. How to replicate for Brazil (PT-BR) and other high-RPM markets
7. Script writing guide step-by-step
8. 5 reusable scene prompt templates
9. 10 video ideas for this niche`;

  let analysis: any;
  try {
    analysis = await aiAnalyze(prompt, apiKey, CHANNEL_DEEP_TOOL);
  } catch (e: any) {
    if (e.message === "rate_limited") {
      console.log("Rate limited, waiting 10s...");
      await new Promise(r => setTimeout(r, 10000));
      analysis = await aiAnalyze(prompt, apiKey, CHANNEL_DEEP_TOOL);
    } else throw e;
  }

  // Save to channel_intelligence
  await sb.from("channel_intelligence").upsert({
    youtube_channel_id: channelId,
    channel_name: channel.snippet.title,
    subscribers: subs,
    avg_views: avgViews,
    niche: analysis.niche || ch.category,
    sub_niche: analysis.sub_niche,
    language: analysis.language || "en",
    country: analysis.country || channel.snippet.country || "US",
    style: analysis.style || "unknown",
    is_faceless: analysis.is_faceless ?? true,
    is_monetized: subs >= 1000,
    growth_rate: analysis.growth_rate || "steady",
    upload_frequency: `${analysis.avg_video_duration_min || 0}min avg`,
    rpm_estimate: analysis.estimated_rpm || 0,
    visual_style_notes: analysis.visual_style_notes,
    top_videos: (analysis.top_video_patterns || topVideos.slice(0, 5)).map((v: any) => ({
      video_id: v.video_id || "",
      title: v.title,
      views: v.views || 0,
      hook_text: v.hook_text || v.why_viral || "",
    })),
    viral_patterns: {
      hook_patterns: analysis.hook_patterns,
      title_formulas: analysis.title_formulas,
      narrative_structure: analysis.narrative_structure,
      scene_types: analysis.scene_types,
      camera_techniques: analysis.camera_techniques,
      music_style: analysis.music_style,
      pacing: analysis.pacing,
      content_model: analysis.content_model,
      is_veo3_style: analysis.is_veo3_style,
      replication_guide_pt: analysis.replication_guide_pt,
      replication_guide_en: analysis.replication_guide_en,
      best_markets: analysis.best_markets,
      psychological_triggers: analysis.psychological_triggers,
      why_successful: analysis.why_successful,
      seo_strategy: analysis.seo_strategy,
      first_10s_hook_style: analysis.first_10s_hook_style,
      script_writing_guide: analysis.script_writing_guide,
      scene_prompt_templates: analysis.scene_prompt_templates,
      ideal_video_ideas: analysis.ideal_video_ideas,
    },
    analyzed_at: new Date().toISOString(),
  }, { onConflict: "youtube_channel_id" });

  // Save top videos to viral_titles_db
  for (const v of topVideos.slice(0, 8)) {
    try {
      await sb.from("viral_titles_db").upsert({
        title: v.title,
        views: v.views,
        likes: v.likes,
        channel_id: channelId,
        channel_name: channel.snippet.title,
        duration_seconds: v.duration_seconds,
        published_at: v.published_at,
        niche: analysis.niche || ch.category,
        language: analysis.language || "en",
      }, { onConflict: "title" });
    } catch (_) { /* skip */ }
  }

  // Save content DNA
  for (const v of topVideos.slice(0, 5)) {
    try {
      const multiplier = avgViews > 0 ? Math.round(v.views / avgViews * 100) / 100 : 1;
      await sb.from("content_dna").upsert({
        video_id: v.video_id,
        video_title: v.title,
        channel_id: channelId,
        channel_name: channel.snippet.title,
        niche: analysis.niche || ch.category,
        language: analysis.language || "en",
        views: v.views,
        subscribers: subs,
        multiplier,
        hook_type: analysis.hook_patterns?.[0] || "story",
        hook_pattern: analysis.hook_patterns?.join(", "),
        title_structure: "story",
        story_structure: analysis.narrative_structure || "hero_journey",
        pacing: analysis.pacing || "medium",
        visual_style: analysis.visual_style_notes,
        emotion_primary: analysis.emotion_primary || "curiosity",
        psychological_triggers: analysis.psychological_triggers || [],
        attention_score: 80,
        curiosity_score: 85,
        dopamine_score: 75,
        estimated_retention: 65,
        why_viral: analysis.why_successful,
        content_model: analysis.content_model || "storytelling",
        viral_score: multiplier >= 3 ? 90 : multiplier >= 2 ? 80 : 70,
        source: "seed-reference-channels",
        video_type: "long",
      }, { onConflict: "video_id" });
    } catch (e) { console.error(`DNA upsert:`, e); }
  }

  // Save viral patterns
  try {
    await sb.from("viral_patterns").insert({
      pattern_name: `${analysis.content_model || ch.category}_${channel.snippet.title.slice(0, 20)}`,
      niche: analysis.niche || ch.category,
      source_video: topVideos[0]?.title || channel.snippet.title,
      pattern_json: {
        hook_types: analysis.hook_patterns,
        emotional_triggers: analysis.psychological_triggers,
        title_formulas: analysis.title_formulas,
        pacing: analysis.pacing,
        scene_types: analysis.scene_types,
        camera_techniques: analysis.camera_techniques,
        narrative_structure: analysis.narrative_structure,
        content_model: analysis.content_model,
        is_veo3: analysis.is_veo3_style,
        replication_guide_pt: analysis.replication_guide_pt,
        best_markets: analysis.best_markets,
        success_factor: analysis.why_successful,
        seo_strategy: analysis.seo_strategy,
        first_10s_hook_style: analysis.first_10s_hook_style,
        script_writing_guide: analysis.script_writing_guide,
        scene_prompt_templates: analysis.scene_prompt_templates,
        ideal_video_ideas: analysis.ideal_video_ideas,
      },
    });
  } catch (_) { /* skip */ }

  return {
    channel: channel.snippet.title,
    channelId,
    status: "ok",
    niche: analysis.niche,
    videos: topVideos.length,
    analysis_summary: {
      content_model: analysis.content_model,
      hook_patterns: analysis.hook_patterns?.slice(0, 3),
      first_10s: analysis.first_10s_hook_style,
      seo: analysis.seo_strategy?.slice(0, 200),
      ideas_count: analysis.ideal_video_ideas?.length || 0,
      scene_templates: analysis.scene_prompt_templates?.length || 0,
      script_guide: analysis.script_writing_guide?.slice(0, 200),
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { start_index = 0, batch_size = 5, custom_channels, mode = "default", target_channel_id } = body;
    
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const ytKeys = getYouTubeKeys();
    if (!ytKeys.length) throw new Error("No YouTube API keys configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Determine channels to process
    let channelsToProcess: { url: string; category: string }[];
    
    if (mode === "custom" && custom_channels && Array.isArray(custom_channels)) {
      // User-provided channels
      channelsToProcess = custom_channels.map((ch: any) => ({
        url: parseChannelInput(typeof ch === "string" ? ch : ch.url),
        category: (typeof ch === "string" ? "user_reference" : ch.category) || "user_reference",
      }));
    } else {
      // Default curated list with dedup
      const seen = new Set<string>();
      channelsToProcess = DEFAULT_CHANNELS.filter(c => {
        const key = c.url.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    const batch = mode === "custom" 
      ? channelsToProcess // Process all custom channels at once
      : channelsToProcess.slice(start_index, start_index + batch_size);
    
    const report: any[] = [];
    let processed = 0, errors = 0;

    // Get user_id from auth header for Dotti sync
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await sb.auth.getUser(token);
      userId = user?.id || null;
    }

    for (const ch of batch) {
      try {
        const result = await processChannel(ch, ytKeys, GOOGLE_AI_API_KEY, sb);
        report.push(result);
        processed++;

        // Save to Dotti suggestions if target channel is specified
        if (target_channel_id && userId && result.status === "ok" && result.analysis_summary) {
          const summary = result.analysis_summary;
          const dottiContent = [
            `📺 Canal Referência: ${result.channel}`,
            `🎬 Modelo: ${summary.content_model}`,
            summary.hook_patterns?.length ? `🎣 Hooks: ${summary.hook_patterns.join(", ")}` : "",
            summary.first_10s ? `⏱️ Primeiros 10s: ${summary.first_10s}` : "",
            summary.seo ? `🔍 SEO: ${summary.seo}` : "",
            summary.script_guide ? `📝 Guia: ${summary.script_guide}` : "",
            `💡 ${summary.ideas_count} ideias · ${summary.scene_templates} templates de cena`,
          ].filter(Boolean).join("\n");

          try {
            await sb.from("dotti_suggestions").insert({
              user_id: userId,
              channel_id: target_channel_id,
              title: `🎬 Análise de Referência: ${result.channel}`,
              content: dottiContent,
              niche: result.niche || "general",
              topic: "reference_analysis",
              style: summary.content_model || "storytelling",
            });
          } catch (e) { console.error("Dotti save error:", e); }
        }

        await new Promise(r => setTimeout(r, 2000));
      } catch (e: any) {
        console.error(`Error processing ${ch.url}:`, e.message);
        errors++;
        report.push({ channel: ch.url, status: "error", error: e.message });
      }
    }

    // Log execution
    try {
      await sb.from("execution_logs").insert({
        function_name: "seed-reference-channels",
        success: errors === 0,
        duration_ms: 0,
        metadata: {
          mode,
          batch_start: start_index,
          batch_size,
          processed,
          errors,
          total_channels: channelsToProcess.length,
          next_index: mode !== "custom" && start_index + batch_size < channelsToProcess.length ? start_index + batch_size : null,
          report,
        },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({
      success: true,
      processed,
      errors,
      total_channels: channelsToProcess.length,
      next_index: mode !== "custom" ? (start_index + batch_size < channelsToProcess.length ? start_index + batch_size : null) : null,
      report,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-reference-channels error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
