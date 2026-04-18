// Static config extracted from ChatbotWidget to reduce bundle size
export const QUICK_ACTIONS = [
  { emoji: '💡', label: 'Ideias de vídeo', message: 'Me sugira 5 ideias de vídeo viral para o meu nicho' },
  { emoji: '✍️', label: 'Dicas de roteiro', message: 'Quais técnicas de hook e retenção devo usar nos meus roteiros? Use dados do banco de conhecimento.' },
  { emoji: '🏷️', label: 'Título viral', message: 'Como criar títulos com alto CTR? Me dê fórmulas e exemplos do banco de títulos virais' },
  { emoji: '💰', label: 'Monetização', message: 'Como monetizar meu canal o mais rápido possível? Quero um plano realista com dados' },
  { emoji: '📊', label: 'Analisar nicho', message: 'Quais são os melhores nichos para começar hoje? Me mostre dados reais de RPM e saturação' },
  { emoji: '🧠', label: 'Algoritmo YouTube', message: 'Me explique como o algoritmo do YouTube funciona em 2025-2026 com dados dos estudos que você tem acesso' },
] as const;

export const PAGE_TOOLTIPS: Record<string, { title: string; desc: string }> = {
  '/dashboard': { title: 'Dashboard', desc: 'Visão geral do seu progresso, métricas e próximas ações inteligentes.' },
  '/search': { title: 'DubSpy', desc: 'Encontra canais que estão crescendo. Use filtros MÍN/MÁX para achar canais que você pode replicar.' },
  '/branding': { title: 'Growth Center', desc: 'Gere branding, nomes de canal e projeções de receita baseadas em nichos reais.' },
  '/niches': { title: 'Niche Explorer', desc: 'Analise nichos com dados reais de RPM, saturação e dificuldade. Encontre oportunidades.' },
  '/scripts': { title: 'Roteiros', desc: 'Gere roteiros virais com IA de nível profissional. Pipeline de 4 fases com fact-check.' },
  '/titles': { title: 'Títulos Virais', desc: 'Gere e teste títulos para máximo CTR. Compare A/B e veja padrões que funcionam.' },
  '/viral-db': { title: 'Viral Database', desc: 'Banco com 900+ títulos virais reais. Descubra padrões, hooks e gatilhos emocionais.' },
  '/workflow': { title: 'Workflow', desc: 'Organize projetos no Kanban. Gerencie do roteiro até a publicação.' },
  '/multichannel': { title: 'Multichannel', desc: 'Gerencie 50+ canais com filas de conteúdo, templates e rollouts por país.' },
  '/channels': { title: 'Meus Canais', desc: 'Vincule canais do YouTube, veja análises e acompanhe concorrentes.' },
};

export const NUDGE_MESSAGES: Record<string, string> = {
  '/dashboard': '💡 Dica: verifique as tendências do seu nicho hoje! Posso ajudar.',
  '/scripts': '✍️ Precisa de ajuda com o roteiro? Posso sugerir hooks de alta retenção.',
  '/titles': '🏷️ Quer que eu analise seus títulos? Tenho dados de 900+ títulos virais.',
  '/search': '🔍 Encontrou algo interessante? Posso fazer engenharia reversa de qualquer canal.',
  '/niches': '📊 Indeciso sobre o nicho? Me pergunte — tenho dados de RPM e saturação.',
  '/workflow': '📋 Seu pipeline está atualizado? Posso sugerir prioridades.',
};
