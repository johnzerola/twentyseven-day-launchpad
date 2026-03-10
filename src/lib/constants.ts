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
