import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Copy, Zap, Target, BookOpen, Search as SearchIcon, Sparkles, Loader2,
  MessageSquare, ThumbsUp, Share2, Bell, ListOrdered, Lightbulb, TrendingUp, Hash
} from 'lucide-react';
import {
  VIRAL_HOOKS, VIRAL_CTAS, VIRAL_TITLE_PATTERNS, STORY_STRUCTURES, SEO_KEYWORD_PATTERNS,
  type ViralHook, type CallToAction, type TitlePattern, type StoryStructure, type SEOKeywordPattern,
  HOOK_STYLES, CTA_TYPES, TITLE_STYLES,
} from '@/lib/viralDatabase';

const TABS = [
  { id: 'hooks', label: 'Hooks', icon: Zap, count: VIRAL_HOOKS.length },
  { id: 'ctas', label: 'CTAs', icon: Target, count: VIRAL_CTAS.length },
  { id: 'titles', label: 'Títulos', icon: Sparkles, count: VIRAL_TITLE_PATTERNS.length },
  { id: 'stories', label: 'Estruturas', icon: BookOpen, count: STORY_STRUCTURES.length },
  { id: 'seo', label: 'SEO', icon: Hash, count: SEO_KEYWORD_PATTERNS.length },
];

const styleColors: Record<string, string> = {
  curiosidade: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  urgência: 'bg-red-500/20 text-red-400 border-red-500/30',
  polêmica: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  storytelling: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  choque: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  empatia: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  números: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  contraintuitivo: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const ctaIcons: Record<string, any> = {
  inscrição: Bell, like: ThumbsUp, comentário: MessageSquare,
  compartilhar: Share2, playlist: ListOrdered, produto: Lightbulb,
};

const copyText = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copiado!');
};

const RetentionBar = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${value}%` }} />
    </div>
    <span className="text-xs font-mono text-emerald-400">{value}%</span>
  </div>
);

const ViralDatabase = () => {
  const [activeTab, setActiveTab] = useState('hooks');
  const [filter, setFilter] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [nicheInput, setNicheInput] = useState('');

  const generateCustom = async () => {
    if (!nicheInput.trim()) return toast.error('Digite um nicho');
    setGenerating(true);
    setAiResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('generate-viral-db', {
        body: { niche: nicheInput, type: activeTab },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiResults(data?.results || []);
      toast.success(`${data?.results?.length || 0} itens gerados por IA!`);
    } catch (err: any) {
      if (err.message?.includes('429')) toast.error('Rate limit. Tente em alguns segundos.');
      else if (err.message?.includes('402')) toast.error('Créditos insuficientes.');
      else toast.error(err.message || 'Erro ao gerar');
    } finally {
      setGenerating(false);
    }
  };

  const filteredHooks = VIRAL_HOOKS.filter(h =>
    (!filter || h.text.toLowerCase().includes(filter.toLowerCase()) || h.niches.some(n => n.includes(filter.toLowerCase()))) &&
    (!styleFilter || h.style === styleFilter)
  );

  const filteredTitles = VIRAL_TITLE_PATTERNS.filter(t =>
    (!filter || t.pattern.toLowerCase().includes(filter.toLowerCase()) || t.example.toLowerCase().includes(filter.toLowerCase())) &&
    (!styleFilter || t.style === styleFilter)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Viral Database</h1>
            <p className="text-sm text-muted-foreground">Banco de hooks, CTAs, padrões de títulos e estruturas de roteiro virais</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setStyleFilter(''); setAiResults([]); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                activeTab === tab.id
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border/50 bg-secondary/30 hover:border-primary/30 text-muted-foreground'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{tab.count}</Badge>
            </button>
          ))}
        </div>

        {/* Search + AI Generate */}
        <div className="glass rounded-xl p-4 space-y-3 border-primary/10">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Filtrar por palavra-chave ou nicho..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-10 bg-secondary/50" />
            </div>
            <div className="flex gap-2 items-center">
              <Input placeholder="Ex: finanças, true crime..." value={nicheInput} onChange={e => setNicheInput(e.target.value)}
                className="w-48 bg-secondary/50" onKeyDown={e => e.key === 'Enter' && generateCustom()} />
              <Button onClick={generateCustom} disabled={generating} className="gradient-hero border-0 gap-2 whitespace-nowrap">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar com IA
              </Button>
            </div>
          </div>
        </div>

        {/* HOOKS TAB */}
        {activeTab === 'hooks' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge className={`cursor-pointer ${!styleFilter ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground'}`} onClick={() => setStyleFilter('')}>Todos</Badge>
              {HOOK_STYLES.map(s => (
                <Badge key={s} className={`cursor-pointer ${styleFilter === s ? styleColors[s] : 'bg-secondary/50 text-muted-foreground'}`} onClick={() => setStyleFilter(styleFilter === s ? '' : s)}>
                  {s}
                </Badge>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {filteredHooks.map((hook, i) => (
                <motion.div key={hook.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="glass rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1">{hook.text}</p>
                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7" onClick={() => copyText(hook.text)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge className={styleColors[hook.style]}>{hook.style}</Badge>
                      {hook.niches.slice(0, 3).map(n => <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>)}
                    </div>
                  </div>
                  <RetentionBar value={hook.estimatedRetention} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* CTAs TAB */}
        {activeTab === 'ctas' && (
          <div className="grid gap-3 md:grid-cols-2">
            {VIRAL_CTAS.map((cta, i) => {
              const Icon = ctaIcons[cta.type] || Target;
              return (
                <motion.div key={cta.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="glass rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm">{cta.text}</p>
                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7" onClick={() => copyText(cta.text)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="gap-1"><Icon className="w-3 h-3" />{cta.type}</Badge>
                      <Badge variant="secondary">{cta.placement}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <div key={j} className={`w-1.5 h-3 rounded-sm ${j < cta.effectiveness ? 'bg-emerald-400' : 'bg-secondary/50'}`} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* TITLES TAB */}
        {activeTab === 'titles' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge className={`cursor-pointer ${!styleFilter ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground'}`} onClick={() => setStyleFilter('')}>Todos</Badge>
              {TITLE_STYLES.map(s => (
                <Badge key={s} className={`cursor-pointer ${styleFilter === s ? styleColors[s] : 'bg-secondary/50 text-muted-foreground'}`} onClick={() => setStyleFilter(styleFilter === s ? '' : s)}>
                  {s}
                </Badge>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {filteredTitles.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="glass rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium font-mono">{t.pattern}</p>
                      <p className="text-xs text-muted-foreground italic">"{t.example}"</p>
                    </div>
                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7" onClick={() => copyText(t.pattern)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className={styleColors[t.style]}>{t.style}</Badge>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-sm font-mono text-emerald-400">{t.avgCTR}% CTR</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* STORIES TAB */}
        {activeTab === 'stories' && (
          <div className="space-y-4">
            {STORY_STRUCTURES.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-5 space-y-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg">{s.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyText(s.phases.map(p => `[${p.duration}] ${p.name}: ${p.tip}`).join('\n'))}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                  </Button>
                </div>
                <div className="space-y-2">
                  {s.phases.map((phase, j) => (
                    <div key={j} className="flex gap-3 items-start p-3 rounded-lg bg-secondary/30 border border-border/30">
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">{j + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{phase.name}</span>
                          <Badge variant="outline" className="text-[10px]">{phase.duration}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{phase.tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <div className="flex gap-1.5 flex-wrap">
                    {s.bestFor.map(b => <Badge key={b} variant="secondary" className="text-[10px]">{b}</Badge>)}
                  </div>
                  <p className="text-[10px] text-muted-foreground max-w-xs text-right">{s.retentionCurve}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* SEO TAB */}
        {activeTab === 'seo' && (
          <div className="grid gap-3 md:grid-cols-2">
            {SEO_KEYWORD_PATTERNS.map((seo, i) => (
              <motion.div key={seo.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="glass rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium font-mono">{seo.pattern}</p>
                  <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                    onClick={() => copyText(seo.pattern)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {seo.examples.map((ex, j) => <Badge key={j} variant="outline" className="text-[10px]">{ex}</Badge>)}
                </div>
                <div className="flex gap-2">
                  <Badge className={seo.searchVolume === 'alto' ? 'bg-emerald-500/20 text-emerald-400' : seo.searchVolume === 'médio' ? 'bg-amber-500/20 text-amber-400' : 'bg-secondary text-muted-foreground'}>
                    Vol: {seo.searchVolume}
                  </Badge>
                  <Badge className={seo.competition === 'baixa' ? 'bg-emerald-500/20 text-emerald-400' : seo.competition === 'média' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}>
                    Comp: {seo.competition}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* AI Results */}
        <AnimatePresence>
          {aiResults.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Gerados por IA para "{nicheInput}"
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {aiResults.map((item: any, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="glass rounded-xl p-4 space-y-2 border-primary/20 hover:border-primary/40 transition-colors group">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{item.text || item.pattern || item.name}</p>
                      <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7"
                        onClick={() => copyText(item.text || item.pattern || item.name)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {item.style && <Badge className={styleColors[item.style] || 'bg-secondary text-muted-foreground'}>{item.style}</Badge>}
                    {item.tip && <p className="text-xs text-muted-foreground">{item.tip}</p>}
                    {item.example && <p className="text-xs text-muted-foreground italic">"{item.example}"</p>}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default ViralDatabase;
