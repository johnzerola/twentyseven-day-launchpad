/**
 * Shared constants used across multiple pages.
 * Avoids duplication of VOICES, COUNTRIES, NICHES, etc.
 */

export const APP_NAME = 'Monetiza27';

export const VOICES = [
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', lang: 'PT-BR', desc: 'Narração masculina natural' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', lang: 'EN-US', desc: 'Voz profunda e clara' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', lang: 'EN-US', desc: 'Feminina profissional' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', lang: 'DE', desc: 'Alemão fluente' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', lang: 'PL', desc: 'Polonês nativo' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', lang: 'ES', desc: 'Espanhol claro' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', lang: 'EN-US', desc: 'Narrador storytelling' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', lang: 'EN-US', desc: 'Jovem e dinâmica' },
] as const;

export const COUNTRIES = [
  { value: '', label: '🌍 Todos os países' },
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'US', label: '🇺🇸 Estados Unidos' },
  { value: 'PT', label: '🇵🇹 Portugal' },
  { value: 'GB', label: '🇬🇧 Reino Unido' },
  { value: 'DE', label: '🇩🇪 Alemanha' },
  { value: 'PL', label: '🇵🇱 Polônia' },
  { value: 'ES', label: '🇪🇸 Espanha' },
  { value: 'MX', label: '🇲🇽 México' },
  { value: 'FR', label: '🇫🇷 França' },
  { value: 'IN', label: '🇮🇳 Índia' },
  { value: 'JP', label: '🇯🇵 Japão' },
  { value: 'CA', label: '🇨🇦 Canadá' },
  { value: 'AU', label: '🇦🇺 Austrália' },
  { value: 'IT', label: '🇮🇹 Itália' },
  { value: 'KR', label: '🇰🇷 Coreia do Sul' },
] as const;

export const NICHES = [
  { value: '', label: 'Qualquer nicho' },
  { value: 'finanças', label: '💰 Finanças' },
  { value: 'tecnologia', label: '💻 Tecnologia' },
  { value: 'saúde', label: '🏥 Saúde' },
  { value: 'gaming', label: '🎮 Gaming' },
  { value: 'educação', label: '📚 Educação' },
  { value: 'entretenimento', label: '🎭 Entretenimento' },
  { value: 'curiosidades', label: '🔍 Curiosidades' },
  { value: 'história', label: '📜 História' },
  { value: 'ciência', label: '🔬 Ciência' },
  { value: 'motivacional', label: '🚀 Motivacional' },
  { value: 'true crime', label: '🔎 True Crime' },
  { value: 'conspiração', label: '👁️ Conspiração' },
  { value: 'top 10', label: '🏆 Top 10 / Listicle' },
  { value: 'receitas', label: '🍳 Receitas' },
  { value: 'viagem', label: '✈️ Viagem' },
] as const;

export const LANGUAGES = [
  { value: '', label: 'Todos idiomas' },
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'pl', label: 'Polski' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
] as const;

export const PERIODS = [
  { value: '', label: 'Qualquer período' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Última semana' },
  { value: 'month', label: 'Último mês' },
  { value: 'year', label: 'Último ano' },
] as const;

/** RPM estimates by niche (USD) — used in Revenue Simulator */
export const RPM_BY_NICHE: Record<string, { min: number; max: number; avg: number }> = {
  'finanças': { min: 8, max: 25, avg: 14 },
  'tecnologia': { min: 6, max: 18, avg: 10 },
  'saúde': { min: 5, max: 15, avg: 9 },
  'gaming': { min: 2, max: 8, avg: 4 },
  'educação': { min: 4, max: 14, avg: 8 },
  'entretenimento': { min: 2, max: 7, avg: 3.5 },
  'curiosidades': { min: 3, max: 10, avg: 5 },
  'história': { min: 4, max: 12, avg: 7 },
  'ciência': { min: 5, max: 14, avg: 8 },
  'motivacional': { min: 4, max: 12, avg: 7 },
  'true crime': { min: 5, max: 16, avg: 9 },
  'conspiração': { min: 3, max: 10, avg: 5 },
  'top 10': { min: 2, max: 8, avg: 4 },
  'receitas': { min: 3, max: 10, avg: 5 },
  'viagem': { min: 4, max: 14, avg: 8 },
  'crypto': { min: 10, max: 35, avg: 18 },
  'imóveis': { min: 8, max: 22, avg: 13 },
  'marketing digital': { min: 6, max: 20, avg: 12 },
  'desenvolvimento pessoal': { min: 4, max: 14, avg: 8 },
  'horror stories': { min: 4, max: 12, avg: 7 },
};

/** Country RPM multiplier relative to US baseline */
export const RPM_COUNTRY_MULTIPLIER: Record<string, number> = {
  US: 1.0,
  GB: 0.9,
  CA: 0.85,
  AU: 0.85,
  DE: 0.75,
  FR: 0.65,
  JP: 0.6,
  KR: 0.55,
  IT: 0.5,
  ES: 0.45,
  PT: 0.4,
  PL: 0.35,
  MX: 0.25,
  BR: 0.3,
  IN: 0.1,
};

/** Growth curve: monthly view multiplier for months 1-12 (faceless channel avg) */
export const GROWTH_CURVE = [0.05, 0.1, 0.18, 0.3, 0.45, 0.6, 0.72, 0.82, 0.88, 0.93, 0.97, 1.0] as const;

/** YouTube Partner Program thresholds (display strings) */
export const YPP_SUBS = '1.000';
export const YPP_HOURS = '4.000h';
