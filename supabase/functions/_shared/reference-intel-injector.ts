/**
 * Reference Intel Injector
 * Two paths to surface a user's reference channel intel inside generation prompts:
 *  1) fetchReferenceIntelBlock — quick role-aware static digest of latest_intel JSON
 *  2) fetchRagChunks — semantic retrieval of the most relevant intel chunks for a topic
 *
 * Roles supported:
 *   model      → copy everything (highest weight)
 *   style      → narration / visual style only
 *   hook       → opening patterns only
 *   format     → structural blueprint only
 *   competitor → same niche, monitor — DO NOT copy, look for gaps
 *   benchmark  → aspirational, far reach — high-level patterns to grow into
 *   anti-model → traps to avoid (negative examples)
 */

const ROLE_LABEL: Record<string, string> = {
  model: "MODELO (copiar)",
  style: "ESTILO",
  hook: "GANCHOS",
  format: "FORMATO",
  competitor: "COMPETIDOR (NÃO copiar — buscar lacunas)",
  benchmark: "BENCHMARK (aspiracional)",
  "anti-model": "ANTI-MODELO (evitar padrões)",
};

const ROLE_DIRECTIVE: Record<string, string> = {
  model: "Use estes padrões como base direta.",
  style: "Adote a estética de narração e visual; ignore estrutura.",
  hook: "Use SOMENTE como inspiração para os primeiros 30s.",
  format: "Replique a estrutura macro; não copie o tom.",
  competitor: "NÃO replique. Identifique o que ELES NÃO fazem e faça você.",
  benchmark: "Aspire a este nível de produção/estrutura, mas mantenha sua escala atual.",
  "anti-model": "EVITE explicitamente os padrões abaixo. São armadilhas conhecidas.",
};

export interface ReferenceIntel {
  channel_name: string;
  role: string;
  intel: any;
}

/**
 * Fetch top N reference channels with intel for a user.
 * Returns formatted prompt block ready to inject into system prompts.
 */
export async function fetchReferenceIntelBlock(
  sb: any,
  userId: string,
  options?: { limit?: number; niche?: string }
): Promise<string> {
  const limit = options?.limit ?? 5;

  try {
    const { data, error } = await sb
      .from("user_reference_channels")
      .select("channel_name, role, latest_intel, last_scanned_at")
      .eq("user_id", userId)
      .not("latest_intel", "is", null)
      .order("last_scanned_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error || !data || data.length === 0) return "";

    const refs = data.filter((r: any) => r.latest_intel && Object.keys(r.latest_intel).length > 0);
    if (refs.length === 0) return "";

    // Group by role so the directive shows once per group
    const grouped: Record<string, any[]> = {};
    for (const r of refs) {
      const role = r.role || "model";
      (grouped[role] ||= []).push(r);
    }

    const sections: string[] = [];
    for (const [role, items] of Object.entries(grouped)) {
      const label = ROLE_LABEL[role] || role.toUpperCase();
      const directive = ROLE_DIRECTIVE[role] || "";
      const channelBlocks = items.map((r: any) => {
        const intel = r.latest_intel || {};
        const patterns = intel.patterns || {};
        const strategy = intel.strategy || {};
        const titlePatterns = patterns.title_patterns || intel.title_patterns || [];
        const hookTypes = patterns.hook_types || intel.hook_types || [];
        const angles = strategy.angles_to_steal || [];
        const ideas = strategy.video_ideas || [];
        const traps = intel.traps || strategy.avoid || [];

        const lines = [`── ${r.channel_name} ──`];
        if (titlePatterns.length) lines.push(`Padrões de título: ${titlePatterns.slice(0, 3).join(' | ')}`);
        if (hookTypes.length) lines.push(`Hooks dominantes: ${hookTypes.slice(0, 3).join(' | ')}`);
        if (role === "anti-model" || role === "competitor") {
          if (traps.length) lines.push(`⚠️ Padrões a evitar: ${traps.slice(0, 3).join(' | ')}`);
        }
        if (role !== "anti-model") {
          if (angles.length) lines.push(`Ângulos: ${angles.slice(0, 3).join(' | ')}`);
          if (ideas.length) lines.push(`Ideias inspiradas: ${ideas.slice(0, 2).join(' | ')}`);
        }
        return lines.join("\n");
      }).join("\n\n");
      sections.push(`▸ ${label} — ${directive}\n${channelBlocks}`);
    }

    return `\n\n🎯 INTELIGÊNCIA DE CANAIS DE REFERÊNCIA DO USUÁRIO:\n${sections.join("\n\n")}\n`;
  } catch (e) {
    console.warn("[reference-intel] fetch failed:", (e as Error).message);
    return "";
  }
}

/**
 * Generate an embedding for a query string via Gemini.
 */
async function embedQuery(googleKey: string, text: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: text.slice(0, 8000) }] },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.embedding?.values || null;
  } catch (e) {
    console.warn("[reference-intel] embedQuery failed:", (e as Error).message);
    return null;
  }
}

/**
 * RAG: Fetch the top-K reference-intel chunks most relevant to the topic.
 * Filters to only this user's reference channels via metadata.user_id.
 * Returns a formatted prompt block, or "" on miss/error.
 */
export async function fetchRagChunks(
  sb: any,
  googleKey: string,
  userId: string,
  topic: string,
  opts?: { matchCount?: number; threshold?: number },
): Promise<string> {
  if (!googleKey || !userId || !topic) return "";
  const matchCount = opts?.matchCount ?? 5;
  const threshold = opts?.threshold ?? 0.3;

  try {
    const queryEmbedding = await embedQuery(googleKey, topic);
    if (!queryEmbedding) return "";

    const { data, error } = await sb.rpc("match_knowledge", {
      query_embedding: queryEmbedding,
      match_count: matchCount * 3, // overfetch then filter by user
      match_threshold: threshold,
      filter_tables: ["user_reference_channels"],
    });
    if (error || !data) return "";

    // Filter to this user only (RPC doesn't support metadata filter directly)
    const userChunks = (data as any[])
      .filter((c) => c?.metadata?.user_id === userId)
      .slice(0, matchCount);
    if (userChunks.length === 0) return "";

    const formatted = userChunks
      .map((c, i) => {
        const channel = c.metadata?.channel_name || "?";
        const role = c.metadata?.role || "model";
        const chunk_type = c.metadata?.chunk_type || "intel";
        const sim = (c.similarity * 100).toFixed(0);
        return `[${i + 1}] ${channel} (${role}, ${chunk_type}, ${sim}% match)\n${c.content_text}`;
      })
      .join("\n\n");

    return `\n\n🎯 PADRÕES DO CANAL MODELO RELEVANTES PARA ESTE TEMA (top ${userChunks.length} via RAG):\n${formatted}\n`;
  } catch (e) {
    console.warn("[reference-intel] RAG failed:", (e as Error).message);
    return "";
  }
}

/**
 * Build embedding chunks from a latest_intel JSON for storage.
 * Returns array of { chunk_type, content_text } ready to be embedded + inserted.
 */
export function buildIntelChunks(channelName: string, role: string, intel: any): Array<{ chunk_type: string; content_text: string }> {
  if (!intel || typeof intel !== "object") return [];
  const chunks: Array<{ chunk_type: string; content_text: string }> = [];
  const patterns = intel.patterns || {};
  const strategy = intel.strategy || {};

  const titlePatterns = patterns.title_patterns || intel.title_patterns || [];
  if (titlePatterns.length) {
    chunks.push({
      chunk_type: "title_patterns",
      content_text: `Canal ${channelName} (${role}) — padrões de TÍTULO:\n${titlePatterns.slice(0, 8).map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}`,
    });
  }

  const hookTypes = patterns.hook_types || intel.hook_types || [];
  if (hookTypes.length) {
    chunks.push({
      chunk_type: "hook_patterns",
      content_text: `Canal ${channelName} (${role}) — padrões de HOOK / abertura:\n${hookTypes.slice(0, 8).map((h: string, i: number) => `${i + 1}. ${h}`).join("\n")}`,
    });
  }

  const pacing = patterns.pacing || patterns.editing || intel.pacing;
  if (pacing) {
    chunks.push({
      chunk_type: "pacing",
      content_text: `Canal ${channelName} (${role}) — RITMO de cortes / edição:\n${typeof pacing === "string" ? pacing : JSON.stringify(pacing)}`,
    });
  }

  const angles = strategy.angles_to_steal || [];
  if (angles.length) {
    chunks.push({
      chunk_type: "angles",
      content_text: `Canal ${channelName} (${role}) — ÂNGULOS estratégicos a aplicar:\n${angles.slice(0, 8).map((a: string, i: number) => `${i + 1}. ${a}`).join("\n")}`,
    });
  }

  const ideas = strategy.video_ideas || [];
  if (ideas.length) {
    chunks.push({
      chunk_type: "video_ideas",
      content_text: `Canal ${channelName} (${role}) — IDEIAS de vídeo inspiradas no canal:\n${ideas.slice(0, 8).map((a: string, i: number) => `${i + 1}. ${a}`).join("\n")}`,
    });
  }

  const traps = intel.traps || strategy.avoid || [];
  if (traps.length) {
    chunks.push({
      chunk_type: "traps_to_avoid",
      content_text: `Canal ${channelName} (${role}) — ARMADILHAS / padrões a EVITAR:\n${traps.slice(0, 6).map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}`,
    });
  }

  // Top performers chunk
  const topPerformers = intel.scanner?.top_performers || intel.recent_videos || [];
  if (topPerformers.length) {
    chunks.push({
      chunk_type: "top_performers",
      content_text: `Canal ${channelName} (${role}) — TÍTULOS top-performers recentes:\n${topPerformers.slice(0, 5).map((v: any) => `• ${v.title || v}`).join("\n")}`,
    });
  }

  return chunks;
}

/**
 * Embed + persist chunks to knowledge_embeddings.
 * Idempotent: deletes existing chunks for this channel before inserting.
 */
export async function persistIntelEmbeddings(
  sb: any,
  googleKey: string,
  channel: { id: string; user_id: string; channel_name: string; role: string },
  intel: any,
): Promise<{ inserted: number; failed: number }> {
  const chunks = buildIntelChunks(channel.channel_name, channel.role, intel);
  if (chunks.length === 0) return { inserted: 0, failed: 0 };

  // Wipe previous embeddings for this channel (idempotent re-scan)
  await sb.from("knowledge_embeddings")
    .delete()
    .eq("source_table", "user_reference_channels")
    .eq("source_id", channel.id);

  let inserted = 0;
  let failed = 0;
  for (const c of chunks) {
    try {
      const emb = await embedQuery(googleKey, c.content_text);
      if (!emb) { failed++; continue; }
      const { error } = await sb.from("knowledge_embeddings").insert({
        source_table: "user_reference_channels",
        source_id: channel.id,
        content_text: c.content_text,
        embedding: emb,
        metadata: {
          user_id: channel.user_id,
          channel_name: channel.channel_name,
          role: channel.role,
          chunk_type: c.chunk_type,
        },
      });
      if (error) { failed++; console.warn("[persistIntel] insert failed:", error.message); }
      else inserted++;
    } catch (e) {
      failed++;
      console.warn("[persistIntel] chunk failed:", (e as Error).message);
    }
  }
  return { inserted, failed };
}
