import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NICHES = [
  // Faceless EN - Core
  "true crime faceless", "dark history faceless", "horror narration", "mystery unsolved cases",
  "survival stories", "western frontier stories", "animal rescue stories", "restoration videos",
  "science explainer faceless", "space exploration faceless", "philosophy faceless",
  "psychology dark facts", "mythology legends", "conspiracy theories deep dive",
  "luxury lifestyle faceless", "finance explainer faceless", "technology AI explainer",
  "reddit stories narration", "creepypasta horror", "nature documentary faceless",
  "motivation self-improvement faceless", "education animated", "cars automotive faceless",
  "cooking faceless overhead", "DIY crafts compilation", "gaming lore explained",
  // Faceless EN - Extended
  "military history faceless", "ancient civilizations documentary", "paranormal investigation faceless",
  "disaster stories narration", "medical mysteries faceless", "serial killer documentary",
  "cold case investigation", "haunted places exploration", "urban legends narration",
  "war stories documentary", "spy espionage stories", "cult documentary faceless",
  "archaeology discoveries", "ocean mysteries deep sea", "volcano earthquake disasters",
  "prison stories narration", "heist stories criminal", "aviation disasters faceless",
  "shipwreck stories maritime", "jungle survival stories", "arctic exploration documentary",
  "abandoned places exploration", "unsolved mysteries compilation", "forensic science faceless",
  "wildlife predators documentary", "insect world faceless", "deep space astronomy",
  "quantum physics explained", "chemistry experiments faceless", "math puzzles explained",
  "AI artificial intelligence documentary", "robotics future technology", "cybersecurity hacking stories",
  "cryptocurrency explained faceless", "stock market analysis faceless", "real estate investing faceless",
  "startup stories business", "billionaire stories faceless", "luxury cars reviews faceless",
  "megastructures engineering", "architecture modern faceless", "interior design faceless",
  "fashion history faceless", "perfume fragrance faceless", "watch luxury collector",
  "wine food documentary", "coffee culture faceless", "street food world faceless",
  "travel hidden gems faceless", "hiking adventure faceless", "camping outdoor survival",
  "fishing hunting outdoor", "martial arts explained", "chess strategy faceless",
  "board games review faceless", "book summary animated", "movie analysis explained",
  "anime explained faceless", "comic book lore", "music theory explained",
  "piano tutorial faceless", "guitar lessons faceless", "sound design ASMR",
  "ASMR relaxation faceless", "meditation guided faceless", "sleep stories narration",
  "productivity tips faceless", "minimalism lifestyle", "stoicism philosophy explained",
  "Buddhism meditation faceless", "mythology Norse gods", "mythology Greek heroes",
  "mythology Egyptian ancient", "mythology Japanese yokai", "mythology Celtic druids",
  "folklore fairy tales dark", "legend King Arthur", "legend Robin Hood",
  "pirate stories golden age", "viking history faceless", "samurai warrior stories",
  "gladiator Roman empire", "medieval castle documentary", "renaissance art history",
  "World War 1 stories", "World War 2 battles", "Cold War espionage",
  "Vietnam War documentary", "American Civil War", "Napoleon Bonaparte history",
  "ancient Rome documentary", "ancient Greece history", "ancient Egypt pharaohs",
  "Mayan Aztec civilization", "dinosaur paleontology", "evolution biology faceless",
  "genetics DNA explained", "virus pandemic stories", "medicine history faceless",
  "surgery medical faceless", "mental health psychology", "addiction recovery stories",
  "relationship advice faceless", "parenting tips animated", "pet care dog training",
  "cat behavior explained", "horse equestrian faceless", "bird watching nature",
  "gardening tips faceless", "farming agriculture faceless", "tiny house living",
  "van life travel faceless", "RV nomad lifestyle", "digital nomad stories",
  "freelancing tips faceless", "side hustle ideas", "passive income explained",
  "dropshipping ecommerce", "Amazon FBA stories", "YouTube growth tips faceless",
  "podcast tips faceless", "social media marketing", "SEO explained faceless",
  "web development tutorial", "graphic design tips", "photography composition",
  "drone cinematography", "3D printing projects", "woodworking crafts faceless",
  "metalworking blacksmith", "pottery ceramics faceless", "painting art tutorial",
  "digital art procreate", "tattoo culture stories", "bodybuilding fitness faceless",
  "calisthenics workout", "yoga flexibility faceless", "running marathon training",
  "swimming technique faceless", "cycling biking faceless", "skateboarding tricks",
  "surfing wave riding", "snowboarding skiing", "climbing bouldering",
  // Faceless PT-BR
  "curiosidades faceless brasil", "história sombria faceless brasil", "true crime brasil faceless",
  "ciência explicada brasil", "psicologia fatos sombrios brasil", "finanças pessoais faceless brasil",
  "mistérios não resolvidos brasil", "terror narração brasil", "motivação faceless brasil",
  "tecnologia IA brasil", "mitologia lendas brasil",
  "casos criminais brasil", "história do brasil colonial", "lendas urbanas brasil",
  "biologia natureza brasil", "astronomia espaço brasil", "filosofia estoicismo brasil",
  "economia investimentos brasil", "empreendedorismo brasil faceless", "saúde mental brasil",
  "nutrição fitness brasil", "animais selvagens brasil", "arqueologia brasil",
  "civilizações antigas brasil", "segunda guerra mundial brasil", "mistérios oceano brasil",
  "desastres naturais brasil", "medicina curiosidades brasil", "direito casos famosos brasil",
  "futebol análise tática brasil", "games lore explicado brasil", "anime explicado brasil",
  "filmes análise brasil", "música teoria brasil", "culinária receitas faceless brasil",
  "viagem dicas brasil", "educação financeira brasil", "produtividade brasil faceless",
  "autoajuda desenvolvimento brasil", "relacionamentos dicas brasil", "carros reviews brasil",
  "arquitetura design brasil", "moda história brasil", "religião história brasil",
  // Faceless ES
  "curiosidades faceless español", "crimen real narración español", "ciencia explicada español",
  "historia oscura español", "terror narración español",
  "misterios sin resolver español", "psicología datos español", "finanzas personales español",
  "tecnología IA español", "mitología leyendas español", "supervivencia historias español",
  "naturaleza documental español", "astronomía espacio español", "filosofía estoicismo español",
  "casos criminales español", "medicina curiosidades español", "animales salvajes español",
  "historia militar español", "civilizaciones antiguas español", "desastres naturales español",
  // Faceless FR
  "crime documentaire français", "histoire sombre français", "mystères non résolus français",
  "science expliquée français", "psychologie faits français", "horreur narration français",
  "technologie IA français", "finance personnelle français", "motivation français faceless",
  "mythologie légendes français", "curiosités monde français", "astronomie espace français",
  // Faceless DE
  "true crime deutsch", "dunkle geschichte deutsch", "wissenschaft erklärt deutsch",
  "mysterien ungelöst deutsch", "psychologie fakten deutsch", "horror erzählung deutsch",
  "technologie KI deutsch", "finanz tipps deutsch", "motivation deutsch faceless",
  // Faceless IT
  "crimini veri italiano", "storia oscura italiano", "scienza spiegata italiano",
  "misteri irrisolti italiano", "psicologia fatti italiano", "orrore narrazione italiano",
  // Faceless PL
  "kryminalne historie polski", "ciemna historia polski", "nauka wyjaśniona polski",
  "tajemnice nierozwiązane polski", "psychologia fakty polski", "horror narracja polski",
  // Faceless JP/KR/Hindi
  "true crime Japanese faceless", "horror stories Japanese", "science explained Hindi faceless",
  "mystery unsolved Korean faceless", "dark history Hindi narration", "technology AI Korean",
  // Shorts viral
  "shorts viral faceless", "shorts facts compilation", "shorts horror 60s",
  "shorts motivation clips", "shorts science experiments", "shorts animal moments viral",
  "shorts history facts", "shorts psychology tricks", "shorts life hacks viral",
  "shorts cooking quick recipes", "shorts fitness workout", "shorts money tips",
  "shorts travel amazing places", "shorts tech gadgets", "shorts art satisfying",
  "shorts nature incredible", "shorts space facts", "shorts cars supercar",
  "shorts gaming highlights", "shorts mystery creepy", "shorts math tricks",
];

const DISCOVERY_TOOL = {
  type: "function" as const,
  function: {
    name: "return_discovered_channels",
    description: "Return a list of YouTube channels discovered for a niche",
    parameters: {
      type: "object",
      properties: {
        channels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              channel_name: { type: "string", description: "Exact channel name as it appears on YouTube" },
              handle: { type: "string", description: "YouTube handle with @ (e.g. @MrBallen)" },
              estimated_subscribers: { type: "number" },
              niche: { type: "string" },
              sub_niche: { type: "string" },
              language: { type: "string", enum: ["en", "pt", "es", "fr", "de", "it", "pl", "other"] },
              country: { type: "string" },
              style: { type: "string", description: "narração sombria, animação, compilação, documental, storytelling, etc." },
              is_faceless: { type: "boolean" },
              growth_rate: { type: "string", enum: ["explosive", "fast", "steady", "slow"] },
              why_successful: { type: "string", description: "1-2 sentences on why this channel succeeds" },
              estimated_avg_views: { type: "number" },
              content_model: { type: "string", enum: ["storytelling", "documentary", "mystery", "drama", "restoration", "compilation", "educational", "emotional", "listicle", "explainer"] },
              visual_style_notes: { type: "string" },
              upload_frequency: { type: "string", enum: ["daily", "2-3x_week", "weekly", "biweekly", "monthly"] },
            },
            required: ["channel_name", "handle", "estimated_subscribers", "niche", "language", "is_faceless", "why_successful"],
            additionalProperties: false,
          },
        },
      },
      required: ["channels"],
      additionalProperties: false,
    },
  },
};

async function discoverNiche(niche: string, apiKey: string, existingHandles: Set<string>): Promise<any[]> {
  const existingList = existingHandles.size > 0
    ? `\n\nCANAIS JÁ NO BANCO (NÃO repetir):\n${[...existingHandles].slice(0, 50).join(', ')}`
    : '';

  const res = await callGeminiOpenAICompat(apiKey, {
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content: `You are a YouTube competitive intelligence expert with deep knowledge of successful channels across all niches and languages. You know channel handles, subscriber counts, content styles, and growth trajectories. Focus on channels that are CURRENTLY active (uploaded in last 3 months) and growing.`
      },
      {
        role: "user",
        content: `Discover 15-20 YouTube channels in this niche: "${niche}"

REQUIREMENTS:
- Prioritize FACELESS channels (narration, animation, compilation, documentary style)
- Include channels from 1K to 10M+ subscribers (mix of sizes)
- Include at least 3 channels under 100K subs that are growing fast
- Include at least 2 channels above 1M subs as benchmarks
- All channels must be REAL and currently active
- Provide accurate handles (@ format)
- Mix of established and emerging channels
${existingList}

Return channels via the tool call with accurate data.`
      },
    ],
    tools: [DISCOVERY_TOOL],
    tool_choice: { type: "function", function: { name: "return_discovered_channels" } },
  });

  if (!res.ok) {
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 3000));
      throw new Error("rate_limited");
    }
    throw new Error(`Gemini ${res.status}`);
  }

  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) return [];

  try {
    const parsed = JSON.parse(tc.function.arguments);
    return (parsed.channels || []).filter((c: any) =>
      c.handle && c.channel_name && !existingHandles.has(c.handle.toLowerCase())
    );
  } catch { return []; }
}

async function verifyAndEnrichWithYouTube(
  channels: any[],
  ytKeys: string[],
): Promise<any[]> {
  if (ytKeys.length === 0 || channels.length === 0) return channels;

  const enriched: any[] = [];
  let keyIdx = 0;

  for (const ch of channels) {
    try {
      const handle = ch.handle.replace(/^@/, "");
      const key = ytKeys[keyIdx % ytKeys.length];

      // Try to resolve channel
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=${encodeURIComponent(handle)}&key=${key}`
      );
      const data = await res.json();

      if (data?.error?.errors?.[0]?.reason === "quotaExceeded") {
        keyIdx++;
        if (keyIdx >= ytKeys.length) break; // All keys exhausted
        continue;
      }

      const item = data?.items?.[0];
      if (item) {
        enriched.push({
          ...ch,
          youtube_channel_id: item.id,
          channel_name: item.snippet.title || ch.channel_name,
          estimated_subscribers: parseInt(item.statistics.subscriberCount || "0"),
          estimated_avg_views: Math.round(parseInt(item.statistics.viewCount || "0") / Math.max(parseInt(item.statistics.videoCount || "1"), 1)),
          country: item.snippet.country || ch.country || "US",
          verified: true,
        });
      } else {
        // Channel not found via handle, add as unverified
        enriched.push({ ...ch, verified: false });
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      enriched.push({ ...ch, verified: false });
    }
  }

  return enriched;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { niches: customNiches, maxNiches = 6, verifyWithYouTube = true } = body;

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Load existing channels to avoid duplicates
    const { data: existing } = await sb.from("channel_intelligence")
      .select("channel_name, youtube_channel_id")
      .limit(1000);

    const existingHandles = new Set(
      (existing || []).map((c: any) => c.channel_name?.toLowerCase())
    );

    // Select niches to scan (random subset or custom)
    const nichesToScan = customNiches?.length > 0
      ? customNiches.slice(0, maxNiches)
      : NICHES.sort(() => Math.random() - 0.5).slice(0, maxNiches);

    console.log(`[DISCOVER] Scanning ${nichesToScan.length} niches:`, nichesToScan);

    const ytKeys = [
      Deno.env.get("YOUTUBE_API_KEY"),
      Deno.env.get("YOUTUBE_API_KEY_2"),
      Deno.env.get("YOUTUBE_API_KEY_3"),
      Deno.env.get("YOUTUBE_API_KEY_4"),
    ].filter(Boolean) as string[];

    let totalDiscovered = 0;
    let totalInserted = 0;
    const nicheResults: Record<string, number> = {};

    for (const niche of nichesToScan) {
      try {
        console.log(`[DISCOVER] Scanning: ${niche}`);

        // Step 1: Gemini discovers channels (no YouTube API cost)
        const discovered = await discoverNiche(niche, GOOGLE_AI_API_KEY, existingHandles);
        console.log(`[DISCOVER] ${niche}: ${discovered.length} channels found by Gemini`);

        if (discovered.length === 0) continue;

        // Step 2: Optionally verify with YouTube API
        const channels = verifyWithYouTube
          ? await verifyAndEnrichWithYouTube(discovered, ytKeys)
          : discovered;

        // Step 3: Upsert to channel_intelligence
        let inserted = 0;
        for (const ch of channels) {
          if (existingHandles.has(ch.channel_name?.toLowerCase())) continue;

          const record: any = {
            channel_name: ch.channel_name,
            youtube_channel_id: ch.youtube_channel_id || `gemini_${ch.handle?.replace('@', '')}`,
            niche: ch.niche || niche.split(' ')[0],
            sub_niche: ch.sub_niche || null,
            language: ch.language || "en",
            country: ch.country || "US",
            style: ch.style || "narração",
            is_faceless: ch.is_faceless !== false,
            is_monetized: (ch.estimated_subscribers || 0) >= 1000,
            subscribers: ch.estimated_subscribers || 0,
            avg_views: ch.estimated_avg_views || 0,
            growth_rate: ch.growth_rate || "steady",
            upload_frequency: ch.upload_frequency || "weekly",
            visual_style_notes: ch.visual_style_notes || null,
            viral_patterns: {
              why_successful: ch.why_successful,
              content_model: ch.content_model,
              source: "gemini_discovery",
              verified: ch.verified || false,
              discovered_at: new Date().toISOString(),
            },
            top_videos: [],
          };

          const { error } = await sb.from("channel_intelligence").upsert(record, {
            onConflict: "youtube_channel_id",
          });

          if (!error) {
            inserted++;
            existingHandles.add(ch.channel_name?.toLowerCase());
          } else {
            console.warn(`[DISCOVER] Insert error for ${ch.channel_name}:`, error.message);
          }
        }

        totalDiscovered += discovered.length;
        totalInserted += inserted;
        nicheResults[niche] = inserted;

        // Delay between niches to avoid rate limits
        await new Promise(r => setTimeout(r, 1500));
      } catch (e: any) {
        console.error(`[DISCOVER] Error on ${niche}:`, e.message);
        if (e.message === "rate_limited") {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    console.log(`[DISCOVER] Complete: ${totalDiscovered} discovered, ${totalInserted} inserted`);

    return new Response(JSON.stringify({
      success: true,
      niches_scanned: nichesToScan.length,
      total_discovered: totalDiscovered,
      total_inserted: totalInserted,
      niche_results: nicheResults,
      youtube_verification: verifyWithYouTube,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[DISCOVER] Fatal:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
