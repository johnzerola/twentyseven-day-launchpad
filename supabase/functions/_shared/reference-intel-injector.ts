/**
 * Reference Intel Injector
 * Fetches user's top reference channels intel and formats it for system prompts.
 * Used by generate-script, generate-titles, viral-diagnosis, analyze-topic.
 */

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
  const limit = options?.limit ?? 3;

  try {
    let query = sb
      .from("user_reference_channels")
      .select("channel_name, role, latest_intel, last_scanned_at")
      .eq("user_id", userId)
      .not("latest_intel", "is", null)
      .order("last_scanned_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return "";

    const refs = data.filter((r: any) => r.latest_intel && Object.keys(r.latest_intel).length > 0);
    if (refs.length === 0) return "";

    const sections = refs.map((r: any) => {
      const intel = r.latest_intel || {};
      const patterns = intel.patterns || {};
      const strategy = intel.strategy || {};
      const titlePatterns = patterns.title_patterns || intel.title_patterns || [];
      const hookTypes = patterns.hook_types || intel.hook_types || [];
      const angles = strategy.angles_to_steal || [];
      const ideas = strategy.video_ideas || [];

      return `── ${r.channel_name} (${r.role}) ──
${titlePatterns.length > 0 ? `Padrões de título: ${titlePatterns.slice(0, 3).join(' | ')}` : ''}
${hookTypes.length > 0 ? `Hooks dominantes: ${hookTypes.slice(0, 3).join(' | ')}` : ''}
${angles.length > 0 ? `Ângulos a aplicar: ${angles.slice(0, 3).join(' | ')}` : ''}
${ideas.length > 0 ? `Ideias inspiradas: ${ideas.slice(0, 2).join(' | ')}` : ''}`.trim();
    }).join("\n\n");

    return `\n\n🎯 INTELIGÊNCIA DE CANAIS DE REFERÊNCIA DO USUÁRIO (use como inspiração estratégica, NÃO copie literalmente):\n${sections}\n`;
  } catch (e) {
    console.warn("[reference-intel] fetch failed:", (e as Error).message);
    return "";
  }
}
