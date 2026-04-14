// Fetch niche-specific skill templates and inject into prompts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface NicheTemplate {
  niche: string;
  style: string;
  display_name: string;
  hook_guidelines: string | null;
  tone_rules: string | null;
  forbidden_patterns: string[] | null;
  example_hooks: string[] | null;
  system_prompt_addition: string | null;
  pacing_notes: string | null;
  emotional_arc_template: string | null;
}

/**
 * Fetch the best-matching niche template for a given niche + style combination.
 * Falls back to niche-only (style='all'), then returns null if nothing found.
 */
export async function fetchNicheTemplate(
  niche: string,
  style?: string,
): Promise<NicheTemplate | null> {
  if (!niche) return null;

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nicheLC = niche.toLowerCase().trim();
    const styleLC = (style || "all").toLowerCase().trim();

    // Try exact match first (niche + style)
    if (styleLC !== "all") {
      const { data: exact } = await sb
        .from("niche_skill_templates")
        .select("*")
        .eq("niche", nicheLC)
        .eq("style", styleLC)
        .eq("is_active", true)
        .maybeSingle();
      if (exact) return exact as NicheTemplate;
    }

    // Fallback: niche + 'all'
    const { data: fallback } = await sb
      .from("niche_skill_templates")
      .select("*")
      .eq("niche", nicheLC)
      .eq("style", "all")
      .eq("is_active", true)
      .maybeSingle();

    return (fallback as NicheTemplate) || null;
  } catch (err) {
    console.warn("[NICHE-TEMPLATES] fetch error:", err);
    return null;
  }
}

/**
 * Build a prompt injection block from a niche template.
 */
export function buildNicheInjection(template: NicheTemplate | null): string {
  if (!template) return "";

  const parts: string[] = [
    `\n═══ 🎯 TEMPLATE DE NICHO: ${template.display_name} ═══`,
  ];

  if (template.hook_guidelines) {
    parts.push(`\n🎣 DIRETRIZES DE HOOK:\n${template.hook_guidelines}`);
  }
  if (template.tone_rules) {
    parts.push(`\n🎤 TOM E LINGUAGEM:\n${template.tone_rules}`);
  }
  if (template.forbidden_patterns && template.forbidden_patterns.length > 0) {
    parts.push(
      `\n🚫 PADRÕES PROIBIDOS NESTE NICHO:\n${template.forbidden_patterns.map((p) => `• ${p}`).join("\n")}`,
    );
  }
  if (template.example_hooks && template.example_hooks.length > 0) {
    parts.push(
      `\n💡 EXEMPLOS DE HOOKS DESTE NICHO:\n${template.example_hooks.map((h) => `• "${h}"`).join("\n")}`,
    );
  }
  if (template.system_prompt_addition) {
    parts.push(`\n📋 REGRAS ESPECIAIS:\n${template.system_prompt_addition}`);
  }
  if (template.pacing_notes) {
    parts.push(`\n⏱️ PACING:\n${template.pacing_notes}`);
  }
  if (template.emotional_arc_template) {
    parts.push(`\n🎭 ARCO EMOCIONAL:\n${template.emotional_arc_template}`);
  }

  parts.push(`\n═══ FIM DO TEMPLATE DE NICHO ═══\n`);
  return parts.join("");
}
