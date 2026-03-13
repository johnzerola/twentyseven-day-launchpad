import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, BookOpen, Film, Clapperboard, Search, Database, RefreshCw, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
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

  useEffect(() => { fetchAll(); }, []);

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
          <Button variant="outline" size="sm" onClick={() => { fetchAll(); toast.success('Dados atualizados'); }} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
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

        {/* Tabs */}
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
