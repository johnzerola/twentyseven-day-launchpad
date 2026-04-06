/**
 * Shared constants used across multiple pages.
 * Avoids duplication of VOICES, COUNTRIES, NICHES, etc.
 */

export const APP_NAME = 'Monetize AI';
export const AI_NAME = 'TubeBot';

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
  { value: 'TR', label: '🇹🇷 Turquia' },
  { value: 'CZ', label: '🇨🇿 República Tcheca' },
  { value: 'NL', label: '🇳🇱 Holanda' },
  { value: 'SE', label: '🇸🇪 Suécia' },
  { value: 'NO', label: '🇳🇴 Noruega' },
  { value: 'DK', label: '🇩🇰 Dinamarca' },
  { value: 'FI', label: '🇫🇮 Finlândia' },
  { value: 'CH', label: '🇨🇭 Suíça' },
  { value: 'AT', label: '🇦🇹 Áustria' },
  { value: 'BE', label: '🇧🇪 Bélgica' },
  { value: 'RO', label: '🇷🇴 Romênia' },
  { value: 'HU', label: '🇭🇺 Hungria' },
  { value: 'GR', label: '🇬🇷 Grécia' },
  { value: 'ID', label: '🇮🇩 Indonésia' },
  { value: 'TH', label: '🇹🇭 Tailândia' },
  { value: 'PH', label: '🇵🇭 Filipinas' },
  { value: 'VN', label: '🇻🇳 Vietnã' },
  { value: 'SA', label: '🇸🇦 Arábia Saudita' },
  { value: 'AE', label: '🇦🇪 Emirados Árabes' },
  { value: 'CO', label: '🇨🇴 Colômbia' },
  { value: 'AR', label: '🇦🇷 Argentina' },
  { value: 'CL', label: '🇨🇱 Chile' },
  { value: 'NG', label: '🇳🇬 Nigéria' },
  { value: 'ZA', label: '🇿🇦 África do Sul' },
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
  { value: 'horror stories', label: '👻 Horror Stories' },
  { value: 'estoicismo', label: '🏛️ Estoicismo' },
  { value: 'IA', label: '🤖 Inteligência Artificial' },
  { value: 'crypto', label: '₿ Crypto' },
  { value: 'psicologia', label: '🧠 Psicologia' },
  { value: 'mitologia', label: '⚡ Mitologia' },
  { value: 'space', label: '🚀 Espaço / Astronomia' },
  { value: 'negócios', label: '📈 Negócios' },
  { value: 'beleza', label: '💄 Beleza' },
  { value: 'fitness', label: '💪 Fitness' },
  { value: 'humor', label: '😂 Humor' },
  { value: 'animais', label: '🐾 Animais' },
  { value: 'relacionamentos', label: '❤️ Relacionamentos' },
  { value: 'carros', label: '🚗 Carros / Automotivo' },
  { value: 'imóveis', label: '🏠 Imóveis' },
  { value: 'marketing digital', label: '📣 Marketing Digital' },
  { value: 'desenvolvimento pessoal', label: '🌱 Desenvolvimento Pessoal' },
] as const;

export const LANGUAGES = [
  { value: '', label: 'Todos idiomas' },
  { value: 'pt', label: '🇧🇷 Português' },
  { value: 'en', label: '🇺🇸 English' },
  { value: 'pl', label: '🇵🇱 Polski' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'tr', label: '🇹🇷 Türkçe' },
  { value: 'cs', label: '🇨🇿 Čeština' },
  { value: 'nl', label: '🇳🇱 Nederlands' },
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'ja', label: '🇯🇵 日本語' },
  { value: 'hi', label: '🇮🇳 हिन्दी' },
  { value: 'ar', label: '🇸🇦 العربية' },
  { value: 'id', label: '🇮🇩 Bahasa Indonesia' },
  { value: 'th', label: '🇹🇭 ไทย' },
  { value: 'vi', label: '🇻🇳 Tiếng Việt' },
  { value: 'ro', label: '🇷🇴 Română' },
  { value: 'hu', label: '🇭🇺 Magyar' },
  { value: 'sv', label: '🇸🇪 Svenska' },
  { value: 'no', label: '🇳🇴 Norsk' },
  { value: 'da', label: '🇩🇰 Dansk' },
  { value: 'fi', label: '🇫🇮 Suomi' },
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
  'estoicismo': { min: 5, max: 15, avg: 9 },
  'IA': { min: 8, max: 22, avg: 14 },
  'psicologia': { min: 5, max: 15, avg: 9 },
  'mitologia': { min: 3, max: 10, avg: 6 },
  'space': { min: 4, max: 14, avg: 8 },
  'negócios': { min: 7, max: 20, avg: 12 },
  'beleza': { min: 3, max: 12, avg: 6 },
  'fitness': { min: 4, max: 14, avg: 8 },
  'humor': { min: 2, max: 6, avg: 3 },
  'animais': { min: 2, max: 8, avg: 4 },
  'relacionamentos': { min: 3, max: 10, avg: 5 },
  'carros': { min: 5, max: 16, avg: 9 },
};

/** Country RPM multiplier relative to US baseline */
export const RPM_COUNTRY_MULTIPLIER: Record<string, number> = {
  US: 1.0,
  GB: 0.9,
  CA: 0.85,
  AU: 0.85,
  CH: 0.95,
  NO: 0.9,
  SE: 0.85,
  DK: 0.85,
  FI: 0.8,
  DE: 0.75,
  NL: 0.7,
  AT: 0.7,
  BE: 0.65,
  FR: 0.65,
  JP: 0.6,
  KR: 0.55,
  IT: 0.5,
  AE: 0.5,
  SA: 0.45,
  ES: 0.45,
  PT: 0.4,
  CZ: 0.38,
  PL: 0.35,
  GR: 0.3,
  TR: 0.28,
  HU: 0.28,
  RO: 0.25,
  MX: 0.25,
  BR: 0.3,
  AR: 0.2,
  CO: 0.2,
  CL: 0.25,
  ZA: 0.2,
  NG: 0.08,
  TH: 0.15,
  ID: 0.12,
  PH: 0.1,
  VN: 0.1,
  IN: 0.1,
};

/** Map country code to primary language code */
export const COUNTRY_LANGUAGE: Record<string, string> = {
  BR: 'pt', PT: 'pt', US: 'en', GB: 'en', CA: 'en', AU: 'en',
  DE: 'de', AT: 'de', CH: 'de', PL: 'pl', ES: 'es', MX: 'es',
  AR: 'es', CO: 'es', CL: 'es', FR: 'fr', BE: 'fr', IT: 'it',
  TR: 'tr', CZ: 'cs', NL: 'nl', SE: 'sv', NO: 'no', DK: 'da',
  FI: 'fi', RO: 'ro', HU: 'hu', GR: 'el', JP: 'ja', KR: 'ko',
  IN: 'hi', SA: 'ar', AE: 'ar', ID: 'id', TH: 'th', PH: 'en',
  VN: 'vi', NG: 'en', ZA: 'en',
};

/** Video content types */
export type VideoType = 'long' | 'short';

export const VIDEO_TYPES = [
  { value: 'long' as const, label: '📺 Vídeo Longo', desc: 'Conteúdo longform (8-60 min)', icon: '📺' },
  { value: 'short' as const, label: '📱 Short', desc: 'Conteúdo vertical (15-60s)', icon: '📱' },
] as const;

export const VIDEO_TYPE_DEFAULTS: Record<VideoType, { minDuration: number; maxDuration: number; defaultDuration: number; aspectRatio: string }> = {
  long: { minDuration: 8, maxDuration: 60, defaultDuration: 15, aspectRatio: '16:9' },
  short: { minDuration: 15, maxDuration: 60, defaultDuration: 45, aspectRatio: '9:16' },
};

/** Growth curve: monthly view multiplier for months 1-12 (faceless channel avg) */
export const GROWTH_CURVE = [0.05, 0.1, 0.18, 0.3, 0.45, 0.6, 0.72, 0.82, 0.88, 0.93, 0.97, 1.0] as const;

/** YouTube Partner Program thresholds (display strings) */
export const YPP_SUBS = '1.000';
export const YPP_HOURS = '4.000h';

/** Easy-to-grow countries for Dotti AI recommendations */
export const EASY_GROWTH_COUNTRIES = [
  { code: 'PL', name: 'Polônia', why: 'Audiência grande (38M), baixa competição faceless, CPM decente para Europa Oriental' },
  { code: 'CZ', name: 'República Tcheca', why: 'Micro-mercado com quase zero competição faceless, audiência educada' },
  { code: 'TR', name: 'Turquia', why: '85M de população, YouTube é plataforma #1, pouquíssimos canais faceless de qualidade' },
  { code: 'RO', name: 'Romênia', why: 'Mercado crescente, competição muito baixa, audiência jovem e engajada' },
  { code: 'HU', name: 'Hungria', why: 'Quase inexistente competição faceless, mercado virgem' },
  { code: 'NL', name: 'Holanda', why: 'RPM alto (0.70x US), população rica, audiência tech-savvy' },
  { code: 'SE', name: 'Suécia', why: 'RPM altíssimo (0.85x US), audiência com alto poder aquisitivo' },
  { code: 'NO', name: 'Noruega', why: 'Top 3 RPM mundial, competição mínima em faceless' },
  { code: 'ID', name: 'Indonésia', why: '270M pessoas, YouTube é a plataforma #1, escala massiva com baixa competição' },
  { code: 'TH', name: 'Tailândia', why: 'Audiência ativa, baixa competição, crescimento rápido' },
  { code: 'VN', name: 'Vietnã', why: '100M pessoas, YouTube em crescimento explosivo, zero faceless de qualidade' },
] as const;
