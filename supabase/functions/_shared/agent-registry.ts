/**
 * Agent Registry — typed manifest of "real agents" available to the meta-orchestrator.
 * Each entry maps a logical agent role to an existing edge function with input/output contracts.
 */

export interface AgentManifest {
  name: string;
  role: string;
  description: string;
  function_name: string;
  input_schema: Record<string, { type: string; required?: boolean; description: string }>;
  output_keys: string[]; // keys the agent writes to shared memory
  cost_estimate_usd: number;
  avg_latency_ms: number;
  dependencies?: string[]; // names of agents that should run first
  category: "research" | "create" | "score" | "predict" | "package";
}

export const AGENT_REGISTRY: Record<string, AgentManifest> = {
  "niche-researcher": {
    name: "niche-researcher",
    role: "Niche Researcher",
    description: "Pesquisa tendências e padrões virais de um nicho usando dados reais do YouTube + IA.",
    function_name: "perplexity-research",
    input_schema: {
      query: { type: "string", required: true, description: "Tópico ou nicho a pesquisar" },
    },
    output_keys: ["research_summary", "trending_topics", "key_insights"],
    cost_estimate_usd: 0.005,
    avg_latency_ms: 8000,
    category: "research",
  },
  "viral-pattern-finder": {
    name: "viral-pattern-finder",
    role: "Viral Pattern Finder",
    description: "Encontra padrões virais (hooks, estruturas, ângulos) no banco de dados de vídeos analisados.",
    function_name: "find-outliers",
    input_schema: {
      niche: { type: "string", required: true, description: "Nicho para buscar padrões" },
      language: { type: "string", required: false, description: "pt-BR, en, etc" },
    },
    output_keys: ["viral_patterns", "top_hooks", "outlier_videos"],
    cost_estimate_usd: 0.001,
    avg_latency_ms: 2000,
    category: "research",
  },
  "competitor-analyzer": {
    name: "competitor-analyzer",
    role: "Competitor Analyzer",
    description: "Identifica e analisa canais competidores no nicho.",
    function_name: "find-competitors-ai",
    input_schema: {
      niche: { type: "string", required: true, description: "Nicho alvo" },
    },
    output_keys: ["competitors", "competitor_analysis"],
    cost_estimate_usd: 0.003,
    avg_latency_ms: 5000,
    category: "research",
  },
  "title-generator": {
    name: "title-generator",
    role: "Title Generator",
    description: "Gera títulos otimizados para CTR baseados em padrões virais.",
    function_name: "generate-titles",
    input_schema: {
      topic: { type: "string", required: true, description: "Tema do vídeo" },
      niche: { type: "string", required: false, description: "Nicho" },
    },
    output_keys: ["titles", "best_title"],
    cost_estimate_usd: 0.002,
    avg_latency_ms: 4000,
    category: "create",
  },
  "script-writer": {
    name: "script-writer",
    role: "Script Writer",
    description: "Escreve roteiro completo (long-form ou shorts) com hook, retenção e CTAs.",
    function_name: "generate-script",
    input_schema: {
      topic: { type: "string", required: true, description: "Tema/título do vídeo" },
      niche: { type: "string", required: false, description: "Nicho" },
      duration_minutes: { type: "number", required: false, description: "Duração alvo" },
    },
    output_keys: ["script", "hook", "structure"],
    cost_estimate_usd: 0.015,
    avg_latency_ms: 25000,
    dependencies: ["title-generator"],
    category: "create",
  },
  "script-scorer": {
    name: "script-scorer",
    role: "Script Scorer",
    description: "Avalia qualidade do roteiro (hook strength, retenção estimada, originalidade).",
    function_name: "score-script",
    input_schema: {
      script: { type: "string", required: true, description: "Texto do roteiro" },
    },
    output_keys: ["score", "weaknesses", "strengths"],
    cost_estimate_usd: 0.002,
    avg_latency_ms: 6000,
    dependencies: ["script-writer"],
    category: "score",
  },
  "retention-predictor": {
    name: "retention-predictor",
    role: "Retention Predictor",
    description: "Prevê curva de retenção do vídeo baseado no roteiro.",
    function_name: "predict-retention",
    input_schema: {
      script: { type: "string", required: true, description: "Texto do roteiro" },
    },
    output_keys: ["retention_curve", "predicted_avd", "drop_off_points"],
    cost_estimate_usd: 0.002,
    avg_latency_ms: 5000,
    dependencies: ["script-writer"],
    category: "predict",
  },
  "thumbnail-prompter": {
    name: "thumbnail-prompter",
    role: "Thumbnail Prompter",
    description: "Gera prompts otimizados para thumbnails de alto CTR.",
    function_name: "generate-thumbnail-prompt",
    input_schema: {
      title: { type: "string", required: true, description: "Título do vídeo" },
      niche: { type: "string", required: false, description: "Nicho" },
    },
    output_keys: ["thumbnail_prompts", "thumbnail_concept"],
    cost_estimate_usd: 0.002,
    avg_latency_ms: 4000,
    dependencies: ["title-generator"],
    category: "package",
  },
  "seo-analyzer": {
    name: "seo-analyzer",
    role: "SEO Analyzer",
    description: "Analisa e otimiza tags, descrição e SEO do vídeo.",
    function_name: "seo-analyzer",
    input_schema: {
      title: { type: "string", required: true, description: "Título" },
      script: { type: "string", required: false, description: "Roteiro para extrair keywords" },
    },
    output_keys: ["tags", "description", "seo_score"],
    cost_estimate_usd: 0.001,
    avg_latency_ms: 3000,
    category: "package",
  },
  "reference-learner": {
    name: "reference-learner",
    role: "Reference Channel Learner",
    description: "Aprende padrões de canais de referência do usuário.",
    function_name: "learn-channel-voice",
    input_schema: {
      channel_id: { type: "string", required: false, description: "ID do canal" },
    },
    output_keys: ["voice_profile", "reference_patterns"],
    cost_estimate_usd: 0.005,
    avg_latency_ms: 12000,
    category: "research",
  },
  "ideas-generator": {
    name: "ideas-generator",
    role: "Ideas Generator",
    description: "Gera ideias de vídeo baseadas em pesquisa + padrões virais.",
    function_name: "generate-ideas",
    input_schema: {
      niche: { type: "string", required: true, description: "Nicho" },
      count: { type: "number", required: false, description: "Quantas ideias (default 5)" },
    },
    output_keys: ["ideas", "best_idea"],
    cost_estimate_usd: 0.003,
    avg_latency_ms: 6000,
    dependencies: ["niche-researcher"],
    category: "create",
  },
  "viral-diagnoser": {
    name: "viral-diagnoser",
    role: "Viral Diagnosis",
    description: "Diagnostica por que um vídeo viralizou (ou não) e extrai lições.",
    function_name: "viral-diagnosis",
    input_schema: {
      video_id: { type: "string", required: true, description: "YouTube video ID" },
    },
    output_keys: ["diagnosis", "viral_factors", "lessons"],
    cost_estimate_usd: 0.004,
    avg_latency_ms: 8000,
    category: "research",
  },
};

export function listAgents(category?: AgentManifest["category"]): AgentManifest[] {
  const all = Object.values(AGENT_REGISTRY);
  return category ? all.filter((a) => a.category === category) : all;
}

export function getAgent(name: string): AgentManifest | null {
  return AGENT_REGISTRY[name] ?? null;
}

/**
 * Compact registry summary for LLM planner context (token-efficient).
 */
export function registryForPlanner(): string {
  return Object.values(AGENT_REGISTRY)
    .map((a) => {
      const inputs = Object.entries(a.input_schema)
        .map(([k, v]) => `${k}${v.required ? "*" : ""}:${v.type}`)
        .join(", ");
      const deps = a.dependencies?.length ? ` [deps: ${a.dependencies.join(",")}]` : "";
      return `- ${a.name} (${a.category}) → ${a.description}\n  inputs: ${inputs}\n  outputs: ${a.output_keys.join(", ")}${deps}`;
    })
    .join("\n");
}
