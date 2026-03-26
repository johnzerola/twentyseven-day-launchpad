import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, BookOpen, Film, Clapperboard, Search, Database, RefreshCw, ChevronDown, ChevronUp, Sparkles, Loader2, Rocket, Dna, TrendingUp, Layers, Tv2 } from 'lucide-react';
import { ReferenceChannelAnalyzer } from '@/components/dashboard/ReferenceChannelAnalyzer';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getAuthHeaders } from '@/lib/auth-fetch';

interface KnowledgeRecord {
  id: string;
  title: string;
  category: string;
  content?: string;
  score?: number;
  tags?: any;
  source?: string;
  content_json?: any;
  prompt_template?: string;
  examples?: any;
  niches?: string[];
  language?: string;
  effectiveness_score?: number;
  viral_score?: number;
  priority?: number;
}

type TabKey = 'youtube' | 'script' | 'viral' | 'scene';

const TAB_CONFIG: Record<TabKey, { label: string; icon: any; table: string; color: string }> = {
  youtube: { label: 'YouTube Knowledge', icon: Brain, table: 'youtube_knowledge', color: 'text-red-400' },
  script: { label: 'Script Knowledge', icon: BookOpen, table: 'script_knowledge', color: 'text-violet-400' },
  viral: { label: 'Viral Content Library', icon: Film, table: 'viral_content_library', color: 'text-amber-400' },
  scene: { label: 'Scene Prompts', icon: Clapperboard, table: 'scene_prompt_knowledge', color: 'text-emerald-400' },
};

const KnowledgeAdmin = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('youtube');
  const [data, setData] = useState<Record<TabKey, KnowledgeRecord[]>>({ youtube: [], script: [], viral: [], scene: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [embeddingStatus, setEmbeddingStatus] = useState<{ total: number; loading: boolean }>({ total: 0, loading: false });
  const [seedingPhase, setSeedingPhase] = useState<string | null>(null);
  const [seedingReport, setSeedingReport] = useState<Record<string, any> | null>(null);
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({});
  const [refChannelLoading, setRefChannelLoading] = useState(false);
  const [refChannelBatch, setRefChannelBatch] = useState(0);
  const [refChannelReport, setRefChannelReport] = useState<any>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyReport, setClassifyReport] = useState<any>(null);
  const [generalCount, setGeneralCount] = useState(0);

  const fetchDbCounts = async () => {
    const tables = ['content_dna', 'viral_patterns', 'score_calibration', 'knowledge_embeddings'];
    const counts: Record<string, number> = {};
    await Promise.all(tables.map(async (t) => {
      const { count } = await supabase.from(t as any).select('*', { count: 'exact', head: true });
      counts[t] = count || 0;
    }));
    setDbCounts(counts);
  };

  const runSeedingPhase = async (phase?: string) => {
    setSeedingPhase(phase || 'all');
    setSeedingReport(null);
    toast.info(`🚀 Seeding Engine: ${phase || 'todas as fases'}... pode levar minutos`);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-seeding-engine`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, channelLimit: 50, embeddingLimit: 100 }),
      });
      const result = await res.json();
      if (result.success) {
        setSeedingReport(result.report);
        toast.success('✅ Seeding concluído!');
        fetchDbCounts();
        fetchEmbeddingCount();
      } else {
        toast.error(result.error || 'Erro no seeding');
      }
    } catch (e) {
      toast.error('Erro de conexão no seeding engine');
    } finally {
      setSeedingPhase(null);
    }
  };

  const fetchEmbeddingCount = async () => {
    const { count } = await supabase.from('knowledge_embeddings').select('*', { count: 'exact', head: true });
    setEmbeddingStatus(prev => ({ ...prev, total: count || 0 }));
  };

  const runBackfill = async (tables?: string[]) => {
    setEmbeddingStatus(prev => ({ ...prev, loading: true }));
    toast.info('Gerando embeddings... isso pode levar alguns minutos');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backfill-embeddings`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 2, tables }),
      });
      const result = await res.json();
      if (result.success) {
        const totalProcessed = Object.values(result.report as Record<string, any>).reduce((s: number, r: any) => s + r.processed, 0);
        toast.success(`${totalProcessed} embeddings gerados com sucesso!`);
        fetchEmbeddingCount();
      } else {
        toast.error(result.error || 'Erro ao gerar embeddings');
      }
    } catch (e) {
      toast.error('Erro de conexão ao gerar embeddings');
    } finally {
      setEmbeddingStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    const [yt, sc, vl, sp] = await Promise.all([
      supabase.from('youtube_knowledge').select('*').order('priority', { ascending: false }),
      supabase.from('script_knowledge').select('*').order('effectiveness_score', { ascending: false }),
      supabase.from('viral_content_library').select('*').order('effectiveness_score', { ascending: false }),
      supabase.from('scene_prompt_knowledge').select('*').order('viral_score', { ascending: false }),
    ]);
    setData({
      youtube: (yt.data || []) as any[],
      script: (sc.data || []) as any[],
      viral: (vl.data || []) as any[],
      scene: (sp.data || []) as any[],
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchAll(); fetchEmbeddingCount(); fetchDbCounts();
    // Count "general" channels
    supabase.from('channel_intelligence').select('*', { count: 'exact', head: true }).eq('content_category', 'general')
      .then(({ count }) => setGeneralCount(count || 0));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    data[activeTab].forEach(r => { if (r.category) cats.add(r.category); });
    return Array.from(cats).sort();
  }, [data, activeTab]);

  const filtered = useMemo(() => {
    let items = data[activeTab];
    if (categoryFilter !== 'all') items = items.filter(r => r.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(r => {
        const title = (r.title || '').toLowerCase();
        const content = (r.content || r.prompt_template || '').toLowerCase();
        const cat = (r.category || '').toLowerCase();
        const json = r.content_json ? JSON.stringify(r.content_json).toLowerCase() : '';
        return title.includes(q) || content.includes(q) || cat.includes(q) || json.includes(q);
      });
    }
    return items;
  }, [data, activeTab, categoryFilter, search]);

  // Reset filters on tab change
  useEffect(() => { setCategoryFilter('all'); setSearch(''); setExpandedId(null); }, [activeTab]);

  const getScore = (r: KnowledgeRecord) => r.effectiveness_score ?? r.viral_score ?? r.priority ?? null;

  const getContentPreview = (r: KnowledgeRecord) => {
    if (r.content) return r.content;
    if (r.prompt_template) return r.prompt_template;
    if (r.content_json) return JSON.stringify(r.content_json, null, 2);
    return '—';
  };

  const scoreColor = (score: number) => {
    if (score >= 9) return 'bg-emerald-500/20 text-emerald-400';
    if (score >= 7) return 'bg-primary/20 text-primary';
    if (score >= 5) return 'bg-amber-500/20 text-amber-400';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] flex items-center gap-2">
              <Database className="w-6 h-6 text-primary" /> Knowledge Base Admin
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {Object.values(data).reduce((s, d) => s + d.length, 0)} registros em 4 bases de conhecimento
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { fetchAll(); fetchEmbeddingCount(); toast.success('Dados atualizados'); }} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => runBackfill()} 
              disabled={embeddingStatus.loading}
              className="gap-2"
            >
              {embeddingStatus.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {embeddingStatus.loading ? 'Gerando...' : `Gerar Embeddings (${embeddingStatus.total} existentes)`}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(TAB_CONFIG) as [TabKey, typeof TAB_CONFIG[TabKey]][]).map(([key, cfg]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`glass rounded-xl p-4 text-left transition-all ${activeTab === key ? 'ring-2 ring-primary/50' : 'hover:bg-secondary/30'}`}>
              <cfg.icon className={`w-5 h-5 mb-2 ${cfg.color}`} />
              <p className="text-2xl font-bold">{data[key].length}</p>
              <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
            </button>
          ))}
        </div>

        {/* 🚀 Data Seeding Engine */}
        <div className="glass rounded-xl p-5 border border-primary/20">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold font-['Space_Grotesk']">Data Seeding Engine</h2>
                <p className="text-xs text-muted-foreground">Transforme dados brutos em inteligência real</p>
              </div>
            </div>
            <Button
              onClick={() => runSeedingPhase()}
              disabled={!!seedingPhase}
              className="gap-2"
              size="sm"
            >
              {seedingPhase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {seedingPhase ? `Fase: ${seedingPhase}...` : 'Executar Todas as Fases'}
            </Button>
          </div>

          {/* Phase stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { key: 'content_dna', label: 'Content DNA', icon: Dna, desc: 'DNA viral de vídeos' },
              { key: 'viral_patterns', label: 'Viral Patterns', icon: TrendingUp, desc: 'Padrões por nicho' },
              { key: 'score_calibration', label: 'Score Calibration', icon: Layers, desc: 'Calibração de scores' },
              { key: 'knowledge_embeddings', label: 'Embeddings', icon: Sparkles, desc: 'Busca semântica' },
            ].map(({ key, label, icon: Icon, desc }) => (
              <div key={key} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-lg font-bold">{dbCounts[key] || 0}</span>
                </div>
                <p className="text-[10px] font-medium">{label}</p>
                <p className="text-[9px] text-muted-foreground">{desc}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-[10px]"
                  disabled={!!seedingPhase}
                  onClick={() => runSeedingPhase(key === 'knowledge_embeddings' ? 'embeddings' : key)}
                >
                  {seedingPhase === key ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Executar'}
                </Button>
              </div>
            ))}
          </div>

          {/* Report */}
          {seedingReport && (
            <div className="bg-background/50 rounded-lg p-3 border border-border/50">
              <p className="text-xs font-medium mb-2 text-emerald-400">✅ Relatório do Seeding</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                {Object.entries(seedingReport).map(([phase, data]: [string, any]) => (
                  <div key={phase} className="bg-secondary/20 rounded p-2">
                    <p className="font-medium">{phase}</p>
                    <p className="text-muted-foreground">
                      {data.processed ?? 0} processados
                      {data.errors ? ` · ${data.errors} erros` : ''}
                      {data.duration_ms ? ` · ${(data.duration_ms / 1000).toFixed(1)}s` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 📺 Seed Reference Channels (Veo3) */}
        <div className="glass rounded-xl p-5 border border-amber-500/20">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Tv2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="font-bold font-['Space_Grotesk']">🎬 Seed Reference Channels (Veo3)</h2>
                <p className="text-xs text-muted-foreground">25 canais curados — Western, Restoration, Drama, Survival, Inspirational</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Batch {refChannelBatch}/5</span>
              <Button
                onClick={async () => {
                  setRefChannelLoading(true);
                  setRefChannelReport(null);
                  toast.info(`🎬 Analisando canais batch ${refChannelBatch}... pode levar ~2min`);
                  try {
                    const headers = await getAuthHeaders();
                    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-reference-channels`, {
                      method: 'POST',
                      headers: { ...headers, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ start_index: refChannelBatch * 5, batch_size: 5 }),
                    });
                    const result = await res.json();
                    if (result.success) {
                      setRefChannelReport(result);
                      if (result.next_index !== null) {
                        setRefChannelBatch(prev => prev + 1);
                      }
                      toast.success(`✅ ${result.processed} canais processados! ${result.next_index !== null ? 'Clique novamente para o próximo batch.' : '🎉 Todos concluídos!'}`);
                      fetchDbCounts();
                    } else {
                      toast.error(result.error || 'Erro ao analisar canais');
                    }
                  } catch (e) {
                    toast.error('Erro de conexão');
                  } finally {
                    setRefChannelLoading(false);
                  }
                }}
                disabled={refChannelLoading}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
                size="sm"
              >
                {refChannelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tv2 className="w-4 h-4" />}
                {refChannelLoading ? 'Analisando...' : `Analisar Próximo Batch (5 canais)`}
              </Button>
            </div>
          </div>

          {refChannelReport && (
            <div className="bg-background/50 rounded-lg p-3 border border-border/50">
              <p className="text-xs font-medium mb-2 text-amber-400">
                ✅ {refChannelReport.processed} processados · {refChannelReport.errors} erros · {refChannelReport.total_channels} canais total
                {refChannelReport.next_index !== null && ` · Próximo: batch ${Math.floor(refChannelReport.next_index / 5)}`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                {(refChannelReport.report || []).map((r: any, i: number) => (
                  <div key={i} className={`rounded p-2 ${r.status === 'ok' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                    <p className="font-medium">{r.channel}</p>
                    <p className="text-muted-foreground">
                      {r.status === 'ok' ? `✅ ${r.niche} · ${r.videos} vídeos` : `❌ ${r.error}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 🎬 User Reference Channel Analyzer */}
        <div className="glass rounded-xl p-5 border border-primary/20">
          <ReferenceChannelAnalyzer />
        </div>

        {/* 🏷️ Classify Channels */}
        {generalCount > 0 && (
          <div className="glass rounded-xl p-5 border border-chart-3/20">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-3/20 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <h2 className="font-bold font-['Space_Grotesk']">🏷️ Classificar Canais</h2>
                  <p className="text-xs text-muted-foreground">{generalCount} canais com niche = "general" precisam de classificação</p>
                </div>
              </div>
              <Button
                onClick={async () => {
                  setClassifyLoading(true);
                  setClassifyReport(null);
                  toast.info(`🏷️ Classificando canais... batch de 50`);
                  try {
                    const headers = await getAuthHeaders();
                    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/classify-channels`, {
                      method: 'POST',
                      headers: { ...headers, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ batchSize: 50 }),
                    });
                    const result = await res.json();
                    setClassifyReport(result);
                    if (result.classified > 0) {
                      setGeneralCount(prev => Math.max(0, prev - result.classified));
                      toast.success(`✅ ${result.classified} canais classificados!`);
                    } else {
                      toast.info(result.message || 'Nenhum canal para classificar');
                    }
                  } catch (e) {
                    toast.error('Erro ao classificar canais');
                  } finally {
                    setClassifyLoading(false);
                  }
                }}
                disabled={classifyLoading}
                className="gap-2"
                size="sm"
              >
                {classifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                {classifyLoading ? 'Classificando...' : `Classificar Próximo Batch (50)`}
              </Button>
            </div>
            {classifyReport && (
              <div className="bg-background/50 rounded-lg p-3 border border-border/50 text-[11px]">
                <p className="text-chart-3 font-medium mb-1">
                  ✅ {classifyReport.classified || 0} classificados · {classifyReport.errors || 0} erros
                </p>
                {classifyReport.results && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-2">
                    {(classifyReport.results || []).slice(0, 12).map((r: any, i: number) => (
                      <div key={i} className="bg-secondary/20 rounded p-1.5">
                        <p className="font-medium truncate">{r.channel_name}</p>
                        <p className="text-muted-foreground">{r.new_category || '?'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabKey)}>
          <TabsList className="w-full grid grid-cols-4 h-auto">
            {(Object.entries(TAB_CONFIG) as [TabKey, typeof TAB_CONFIG[TabKey]][]).map(([key, cfg]) => (
              <TabsTrigger key={key} value={key} className="gap-2 text-xs py-2.5">
                <cfg.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{cfg.label}</span>
                <Badge variant="secondary" className="text-[9px] px-1">{data[key].length}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por título, conteúdo, categoria..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrar categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias ({data[activeTab].length})</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>
                    {c} ({data[activeTab].filter(r => r.category === c).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          {(Object.keys(TAB_CONFIG) as TabKey[]).map(tabKey => (
            <TabsContent key={tabKey} value={tabKey} className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum registro encontrado</p>
                  {(search || categoryFilter !== 'all') && (
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(''); setCategoryFilter('all'); }}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{filtered.length} registro(s)</p>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((record, i) => {
                      const score = getScore(record);
                      const expanded = expandedId === record.id;
                      const preview = getContentPreview(record);
                      const tags = Array.isArray(record.tags) ? record.tags : [];
                      const niches = record.niches || [];

                      return (
                        <motion.div key={record.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                          className="glass rounded-xl overflow-hidden">
                          <button className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-secondary/20 transition-colors"
                            onClick={() => setExpandedId(expanded ? null : record.id)}>
                            {score !== null && (
                              <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${scoreColor(score)}`}>
                                {score}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{record.title || record.id.slice(0, 8)}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <Badge variant="outline" className="text-[9px] px-1.5">{record.category}</Badge>
                                {record.source && <span className="text-[9px] text-muted-foreground">via {record.source}</span>}
                                {record.language && <span className="text-[9px] text-muted-foreground">{record.language}</span>}
                              </div>
                            </div>
                            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                          </button>

                          <AnimatePresence>
                            {expanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                className="border-t border-border">
                                <div className="px-4 py-3 space-y-3">
                                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-secondary/20 rounded-lg p-3 max-h-[300px] overflow-y-auto font-mono leading-relaxed">
                                    {preview}
                                  </pre>

                                  {(tags.length > 0 || niches.length > 0) && (
                                    <div className="flex flex-wrap gap-1">
                                      {tags.map((t: string, j: number) => (
                                        <Badge key={j} variant="secondary" className="text-[9px]">{String(t)}</Badge>
                                      ))}
                                      {niches.map((n: string, j: number) => (
                                        <Badge key={`n-${j}`} className="text-[9px] bg-primary/10 text-primary">{n}</Badge>
                                      ))}
                                    </div>
                                  )}

                                  {record.examples && Array.isArray(record.examples) && record.examples.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">Exemplos:</p>
                                      <div className="space-y-1">
                                        {record.examples.slice(0, 3).map((ex: string, j: number) => (
                                          <p key={j} className="text-[10px] text-muted-foreground bg-secondary/10 rounded px-2 py-1">"{ex}"</p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default KnowledgeAdmin;
