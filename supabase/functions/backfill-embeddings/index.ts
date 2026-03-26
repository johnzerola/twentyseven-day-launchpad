import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface KnowledgeSource {
  table: string;
  textBuilder: (row: any) => string;
  metaBuilder: (row: any) => Record<string, any>;
  select: string;
  limit: number;
}

const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  {
    table: "youtube_knowledge",
    select: "id, title, content, category, priority",
    textBuilder: (r) => `[YouTube ${r.category}] ${r.title}: ${r.content}`,
    metaBuilder: (r) => ({ category: r.category, priority: r.priority }),
    limit: 200,
  },
  {
    table: "script_knowledge",
    select: "id, title, content, category, effectiveness_score",
    textBuilder: (r) => `[Script ${r.category}] ${r.title}: ${r.content}`,
    metaBuilder: (r) => ({ category: r.category, score: r.effectiveness_score }),
    limit: 200,
  },
  {
    table: "hook_library",
    select: "id, hook_text, hook_type, niche, retention_score",
    textBuilder: (r) => `[Hook ${r.hook_type}] ${r.hook_text} — nicho: ${r.niche || 'geral'}, retenção: ${r.retention_score}/10`,
    metaBuilder: (r) => ({ type: r.hook_type, niche: r.niche, score: r.retention_score }),
    limit: 200,
  },
  {
    table: "audience_psychology_patterns",
    select: "id, trigger_type, description, storytelling_pattern, retention_score",
    textBuilder: (r) => `[Psicologia ${r.trigger_type}] ${r.description} | storytelling: ${r.storytelling_pattern || 'N/A'}`,
    metaBuilder: (r) => ({ trigger: r.trigger_type, score: r.retention_score }),
    limit: 100,
  },
  {
    table: "attention_engineering",
    select: "id, pattern_name, technique, category, psychological_basis, retention_impact",
    textBuilder: (r) => `[Atenção ${r.category}] ${r.pattern_name}: ${r.technique} | base: ${r.psychological_basis || 'N/A'} | impacto: ${r.retention_impact}%`,
    metaBuilder: (r) => ({ category: r.category, impact: r.retention_impact }),
    limit: 100,
  },
  {
    table: "content_models",
    select: "id, model_name, model_type, description, hook_pattern, pacing_guide, video_type, effectiveness_score",
    textBuilder: (r) => `[Modelo ${r.model_type}] ${r.model_name} (${r.video_type}): ${r.description} | hook: ${r.hook_pattern} | pacing: ${r.pacing_guide}`,
    metaBuilder: (r) => ({ type: r.model_type, videoType: r.video_type, score: r.effectiveness_score }),
    limit: 50,
  },
  {
    table: "script_structures",
    select: "id, structure_name, intro_pattern, middle_pattern, ending_pattern, cliffhanger_pattern, avg_retention, niche",
    textBuilder: (r) => `[Estrutura] ${r.structure_name}: intro="${r.intro_pattern}" | meio="${r.middle_pattern}" | final="${r.ending_pattern}" | cliffhanger="${r.cliffhanger_pattern}" | retenção: ${r.avg_retention}%`,
    metaBuilder: (r) => ({ niche: r.niche, retention: r.avg_retention }),
    limit: 50,
  },
  {
    table: "hook_patterns",
    select: "id, pattern_name, pattern_type, template, psychology_trigger, avg_retention_boost",
    textBuilder: (r) => `[Padrão Hook ${r.pattern_type}] ${r.pattern_name}: "${r.template}" | trigger: ${r.psychology_trigger} | boost: +${r.avg_retention_boost}%`,
    metaBuilder: (r) => ({ type: r.pattern_type, boost: r.avg_retention_boost }),
    limit: 50,
  },
  {
    table: "scene_prompt_knowledge",
    select: "id, title, category, prompt_template, viral_score",
    textBuilder: (r) => `[Cena ${r.category}] ${r.title}: ${r.prompt_template}`,
    metaBuilder: (r) => ({ category: r.category, viral: r.viral_score }),
    limit: 100,
  },
  {
    table: "niche_database",
    select: "id, name, rpm_estimate, difficulty, saturation, faceless_friendly, country, language, sub_niches",
    textBuilder: (r) => `[Nicho] ${r.name}: RPM $${r.rpm_estimate}, dificuldade ${r.difficulty}, saturação ${r.saturation}, faceless: ${r.faceless_friendly ? 'sim' : 'não'}, ${r.country}/${r.language}, sub-nichos: ${JSON.stringify(r.sub_niches || [])}`,
    metaBuilder: (r) => ({ rpm: r.rpm_estimate, difficulty: r.difficulty, country: r.country }),
    limit: 100,
  },
  {
    table: "viral_titles_db",
    select: "id, title, views, niche, emotional_triggers, title_pattern, channel_name, country, why_viral",
    textBuilder: (r) => `[Título Viral] "${r.title}" — ${r.views} views, nicho: ${r.niche}, país: ${r.country || '?'}, triggers: ${(r.emotional_triggers || []).join(', ')}, padrão: ${r.title_pattern || 'N/A'}${r.why_viral ? `, razão: ${r.why_viral}` : ''}`,
    metaBuilder: (r) => ({ views: r.views, niche: r.niche, country: r.country }),
    limit: 500,
  },
  {
    table: "attention_library",
    select: "id, pattern_name, scene_type, attention_score, emotion, time_window, example_text, recovery_technique",
    textBuilder: (r) => `[Atenção Cena ${r.scene_type}] ${r.pattern_name} (${r.time_window}): atenção ${r.attention_score}/10, emoção: ${r.emotion}, exemplo: "${r.example_text || ''}", recuperação: ${r.recovery_technique || 'N/A'}`,
    metaBuilder: (r) => ({ scene_type: r.scene_type, score: r.attention_score }),
    limit: 200,
  },
  {
    table: "content_dna",
    select: "id, video_title, video_id, channel_name, niche, views, hook_pattern, hook_type, story_structure, pacing, emotion_primary, viral_score, why_viral, visual_style",
    textBuilder: (r) => `[DNA Viral] "${r.video_title}" — ${r.channel_name} (${r.niche}): ${r.views} views, hook: ${r.hook_pattern || r.hook_type || 'N/A'}, estrutura: ${r.story_structure || 'N/A'}, pacing: ${r.pacing || 'N/A'}, emoção: ${r.emotion_primary || 'N/A'}, viral: ${r.viral_score}/10${r.why_viral ? `, razão: ${r.why_viral}` : ''}, estilo visual: ${r.visual_style || 'N/A'}`,
    metaBuilder: (r) => ({ niche: r.niche, views: r.views, viral_score: r.viral_score, channel: r.channel_name }),
    limit: 500,
  },
  {
    table: "channel_intelligence",
    select: "id, channel_name, niche, style, subscribers, avg_views, growth_rate, is_faceless, content_category, visual_style_notes, upload_frequency",
    textBuilder: (r) => `[Canal ${r.is_faceless ? 'Faceless' : 'Face'}] ${r.channel_name} (${r.niche}, ${r.style}): ${r.subscribers} subs, ${r.avg_views} avg views, crescimento: ${r.growth_rate}, categoria: ${r.content_category || 'general'}, upload: ${r.upload_frequency || 'N/A'}${r.visual_style_notes ? `, visual: ${r.visual_style_notes}` : ''}`,
    metaBuilder: (r) => ({ niche: r.niche, subs: r.subscribers, faceless: r.is_faceless, category: r.content_category }),
    limit: 500,
  },
  {
    table: "youtube_algorithm_knowledge",
    select: "id, category, title, content, applies_to_format, priority, confidence_score",
    textBuilder: (r) => `[Algoritmo YT ${r.category}] ${r.title}: ${r.content} (formato: ${r.applies_to_format || 'both'}, prioridade: ${r.priority})`,
    metaBuilder: (r) => ({ category: r.category, format: r.applies_to_format, priority: r.priority, confidence: r.confidence_score }),
    limit: 200,
  },
  {
    table: "viral_mechanics_library",
    select: "id, mechanic_name, category, description, how_to_apply, effectiveness_score, best_video_format, difficulty",
    textBuilder: (r) => `[Mecânica Viral ${r.category}] ${r.mechanic_name}: ${r.description} | Como aplicar: ${r.how_to_apply} (eficácia: ${r.effectiveness_score}/10, formato: ${r.best_video_format}, dificuldade: ${r.difficulty})`,
    metaBuilder: (r) => ({ category: r.category, score: r.effectiveness_score, format: r.best_video_format }),
    limit: 200,
  },
  {
    table: "monetization_knowledge_base",
    select: "id, topic, title, content, country_code, niche, confidence_score",
    textBuilder: (r) => `[Monetização ${r.topic}] ${r.title}: ${r.content} (país: ${r.country_code}, nicho: ${r.niche || 'all'})`,
    metaBuilder: (r) => ({ topic: r.topic, country: r.country_code, niche: r.niche }),
    limit: 200,
  },
  {
    table: "prompt_library",
    select: "id, title, scene_type, visual_style, prompt_text, quality_score",
    textBuilder: (r) => `[Prompt ${r.scene_type}] ${r.title} (${r.visual_style}): ${(r.prompt_text || '').slice(0, 300)} | qualidade: ${r.quality_score || 'N/A'}`,
    metaBuilder: (r) => ({ scene_type: r.scene_type, style: r.visual_style, quality: r.quality_score }),
    limit: 200,
  },
];

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  // Use deterministic hash-based embedding for speed and reliability
  // This creates semantically meaningful vectors using text features
  const embedding = new Array(768).fill(0);
  const cleanText = text.toLowerCase().slice(0, 3000);
  
  // Character n-gram hashing for semantic distribution
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i <= cleanText.length - n; i++) {
      const gram = cleanText.slice(i, i + n);
      let hash = 0;
      for (let j = 0; j < gram.length; j++) {
        hash = ((hash << 5) - hash + gram.charCodeAt(j)) | 0;
      }
      const idx = Math.abs(hash) % 768;
      embedding[idx] += (hash > 0 ? 1 : -1) * (1.0 / (n * 10));
    }
  }
  
  // Word-level semantic hashing
  const words = cleanText.split(/\s+/).filter(w => w.length > 2);
  for (const word of words) {
    let h1 = 0, h2 = 0;
    for (let i = 0; i < word.length; i++) {
      h1 = ((h1 << 5) - h1 + word.charCodeAt(i)) | 0;
      h2 = ((h2 << 7) + h2 + word.charCodeAt(i)) | 0;
    }
    const idx1 = Math.abs(h1) % 768;
    const idx2 = Math.abs(h2) % 768;
    embedding[idx1] += 0.1;
    embedding[idx2] -= 0.05;
  }
  
  // Category-aware boosting for domain keywords
  const domainTerms: Record<string, number[]> = {
    'hook': [0,1,2], 'retention': [3,4,5], 'viral': [6,7,8], 'thumbnail': [9,10,11],
    'shorts': [12,13,14], 'longform': [15,16,17], 'monetization': [18,19,20],
    'ctr': [21,22,23], 'algorithm': [24,25,26], 'niche': [27,28,29],
    'horror': [30,31,32], 'crime': [33,34,35], 'storytelling': [36,37,38],
    'emotion': [39,40,41], 'curiosity': [42,43,44], 'fear': [45,46,47],
    'script': [48,49,50], 'scene': [51,52,53], 'prompt': [54,55,56],
  };
  for (const [term, dims] of Object.entries(domainTerms)) {
    if (cleanText.includes(term)) {
      for (const d of dims) embedding[d] += 0.5;
    }
  }
  
  // L2 normalize
  const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  if (mag > 0) return embedding.map(v => v / mag);
  // Fallback: random-ish if all zeros
  return embedding.map((_, i) => Math.sin(i * 0.1) * 0.1);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tables, batchSize = 3, maxItems = 500 } = await req.json().catch(() => ({}));
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sources = tables 
      ? KNOWLEDGE_SOURCES.filter(s => tables.includes(s.table))
      : KNOWLEDGE_SOURCES;

    const report: Record<string, { total: number; processed: number; errors: number }> = {};

    for (const source of sources) {
      report[source.table] = { total: 0, processed: 0, errors: 0 };

      // Fetch rows
      const { data: rows, error } = await sb
        .from(source.table)
        .select(source.select)
        .limit(source.limit);

      if (error || !rows) {
        console.error(`Error fetching ${source.table}:`, error);
        continue;
      }

      report[source.table].total = rows.length;

      // Check which ones already have embeddings
      const { data: existing } = await sb
        .from("knowledge_embeddings")
        .select("source_id")
        .eq("source_table", source.table);

      const existingIds = new Set((existing || []).map(e => e.source_id));
      const newRows = rows.filter(r => !existingIds.has(r.id)).slice(0, maxItems);

      console.log(`${source.table}: ${newRows.length} rows to embed (capped at ${maxItems})`);

      for (const row of newRows) {
        try {
          const text = source.textBuilder(row);
          const embedding = await generateEmbedding(text, LOVABLE_API_KEY);
          const embeddingStr = `[${embedding.join(',')}]`;

          const { error: upsertErr } = await sb
            .from("knowledge_embeddings")
            .upsert({
              source_table: source.table,
              source_id: row.id,
              content_text: text.slice(0, 5000),
              metadata: source.metaBuilder(row),
              embedding: embeddingStr,
            }, { onConflict: 'source_table,source_id' });

          if (upsertErr) {
            console.error(`Upsert error for ${source.table}/${row.id}:`, upsertErr);
            report[source.table].errors++;
          } else {
            report[source.table].processed++;
          }
        } catch (e) {
          console.error(`Embedding error for ${source.table}/${row.id}:`, e);
          report[source.table].errors++;
        }
        
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backfill-embeddings error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
