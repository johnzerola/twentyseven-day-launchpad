/**
 * Learning Loop Injector
 * Fetches per-user learned patterns (CTR + hook performance) and formats them
 * as injection blocks for system prompts in generators.
 */

export interface CtrPatterns {
  winning_patterns?: string[];
  losing_patterns?: string[];
  best_openers?: string[];
  niche_power_words?: string[];
  optimal_length?: number | null;
  data_points?: number;
  avg_ctr?: number | null;
  top_ctr?: number | null;
}

export async function fetchUserCtrPatternsBlock(
  sb: any,
  userId: string | null | undefined,
  niche: string | null | undefined
): Promise<string> {
  if (!userId) return "";
  try {
    const targetNiche = (niche || "general").toLowerCase();
    const { data } = await sb
      .from("user_ctr_patterns")
      .select("*")
      .eq("user_id", userId)
      .in("niche", [targetNiche, "general"])
      .order("data_points", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data || !data.data_points || data.data_points < 3) return "";

    const win = (data.winning_patterns || []).slice(0, 5);
    const lose = (data.losing_patterns || []).slice(0, 5);
    const openers = (data.best_openers || []).slice(0, 5);
    const power = (data.niche_power_words || []).slice(0, 8);

    return `

⭐ PADRÕES REAIS DO CANAL DESTE USUÁRIO (baseado em ${data.data_points} vídeos publicados, CTR médio ${(data.avg_ctr ?? 0).toFixed(1)}%):
✅ FUNCIONA neste canal: ${win.join(' | ') || '—'}
❌ NÃO FUNCIONA: ${lose.join(' | ') || '—'}
🎯 Aberturas de alta conversão: ${openers.join(' | ') || '—'}
💪 Power words do nicho: ${power.join(', ') || '—'}
${data.optimal_length ? `📏 Comprimento ideal de título: ~${data.optimal_length} caracteres` : ''}

INSTRUÇÃO: Priorize esses padrões reais sobre teoria genérica. Evite os padrões negativos.
`;
  } catch (e) {
    console.warn("[learning-loop] ctr fetch failed:", (e as Error).message);
    return "";
  }
}

export async function fetchHookPerformanceBlock(
  sb: any,
  userId: string | null | undefined,
  niche: string | null | undefined
): Promise<string> {
  if (!userId) return "";
  try {
    const { data } = await sb
      .from("hook_performance_real")
      .select("hook_type, retention_30s, avg_retention")
      .eq("user_id", userId)
      .not("hook_type", "is", null)
      .not("retention_30s", "is", null);

    if (!data || data.length < 5) return "";

    const byType: Record<string, { sum30: number; sumAvg: number; n: number }> = {};
    for (const r of data) {
      const t = r.hook_type as string;
      if (!byType[t]) byType[t] = { sum30: 0, sumAvg: 0, n: 0 };
      byType[t].sum30 += Number(r.retention_30s) || 0;
      byType[t].sumAvg += Number(r.avg_retention) || 0;
      byType[t].n += 1;
    }

    const ranked = Object.entries(byType)
      .filter(([, v]) => v.n >= 2)
      .map(([type, v]) => ({
        type,
        n: v.n,
        ret30: v.sum30 / v.n,
        retAvg: v.sumAvg / v.n,
      }))
      .sort((a, b) => b.ret30 - a.ret30);

    if (ranked.length === 0) return "";

    const lines = ranked.slice(0, 6).map(
      r => `• ${r.type}: ret 30s ${r.ret30.toFixed(0)}% (n=${r.n})`
    );

    return `

🪝 HOOKS QUE FUNCIONAM NESTE CANAL (dados reais YouTube Analytics):
${lines.join('\n')}

INSTRUÇÃO: Priorize o hook_type com maior retenção 30s comprovada para este canal.
`;
  } catch (e) {
    console.warn("[learning-loop] hook fetch failed:", (e as Error).message);
    return "";
  }
}

export async function fetchThumbnailStyleBlock(
  sb: any,
  userId: string | null | undefined
): Promise<string> {
  if (!userId) return "";
  try {
    const { data } = await sb
      .from("chosen_thumbnails")
      .select("style_summary, ctr_actual, variant_data")
      .eq("user_id", userId)
      .not("ctr_actual", "is", null);

    if (!data || data.length < 3) return "";

    const byStyle: Record<string, { sum: number; n: number }> = {};
    for (const r of data) {
      const key = (r.style_summary || (r.variant_data as any)?.style || "unknown").toString();
      if (!byStyle[key]) byStyle[key] = { sum: 0, n: 0 };
      byStyle[key].sum += Number(r.ctr_actual) || 0;
      byStyle[key].n += 1;
    }

    const ranked = Object.entries(byStyle)
      .map(([style, v]) => ({ style, ctr: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.ctr - a.ctr)
      .slice(0, 5);

    const lines = ranked.map(r => `• ${r.style}: CTR ${r.ctr.toFixed(1)}% (n=${r.n})`);

    return `

🖼️ ESTILOS DE THUMB QUE CONVERTEM NESTE CANAL (dados reais):
${lines.join('\n')}

INSTRUÇÃO: Priorize estilos visuais com CTR comprovado.
`;
  } catch (e) {
    console.warn("[learning-loop] thumb fetch failed:", (e as Error).message);
    return "";
  }
}
