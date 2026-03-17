import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Tv2, Plus, Trash2, ExternalLink, BookOpen, Sparkles, Eye, Target, Film } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthHeaders } from '@/lib/auth-fetch';
import { motion, AnimatePresence } from 'framer-motion';

interface AnalysisReport {
  channel: string;
  channelId?: string;
  status: string;
  niche?: string;
  videos?: number;
  error?: string;
  analysis_summary?: {
    content_model: string;
    hook_patterns: string[];
    first_10s: string;
    seo: string;
    ideas_count: number;
    scene_templates: number;
    script_guide: string;
  };
}

export const ReferenceChannelAnalyzer = () => {
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const lines = urls
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5);

    if (lines.length === 0) {
      toast.error('Cole pelo menos 1 URL de canal');
      return;
    }

    if (lines.length > 10) {
      toast.error('Máximo 10 canais por vez para evitar timeout');
      return;
    }

    setLoading(true);
    setReports([]);
    toast.info(`🔍 Analisando ${lines.length} canais... isso pode levar ${lines.length * 30}s`);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-reference-channels`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'custom',
          custom_channels: lines,
        }),
      });
      const result = await res.json();

      if (result.success) {
        setReports(result.report || []);
        toast.success(`✅ ${result.processed} canais analisados! ${result.errors > 0 ? `(${result.errors} erros)` : ''}`);
      } else {
        toast.error(result.error || 'Erro ao analisar');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
          <Tv2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold font-['Space_Grotesk'] text-lg">🎬 Analisador de Canais de Referência</h2>
          <p className="text-xs text-muted-foreground">
            Cole URLs de canais YouTube para a IA analisar roteiros, SEO, títulos, cenas e criar guias de replicação
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-3">
        <Textarea
          placeholder={`Cole URLs de canais YouTube (1 por linha, máx 10):

https://www.youtube.com/@CanalExemplo
https://www.youtube.com/@OutroCanal/videos
https://www.youtube.com/channel/UC...`}
          value={urls}
          onChange={e => setUrls(e.target.value)}
          rows={6}
          className="font-mono text-xs resize-none"
          disabled={loading}
        />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            {urls.split('\n').filter(l => l.trim().length > 5).length} canais detectados · 
            A IA vai analisar: roteiros, hooks, SEO, cenas, títulos e gerar guias completos
          </p>
          <Button
            onClick={handleAnalyze}
            disabled={loading || urls.trim().length < 5}
            className="gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analisando...' : 'Analisar Canais'}
          </Button>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {reports.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Relatórios de Análise
              <Badge className="bg-primary/20 text-primary text-[10px]">{reports.filter(r => r.status === 'ok').length} sucesso</Badge>
            </h3>

            <div className="grid gap-3">
              {reports.map((report, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`border rounded-xl p-4 transition-colors cursor-pointer ${
                    report.status === 'ok'
                      ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                      : 'border-red-500/30 bg-red-500/5'
                  }`}
                  onClick={() => setExpandedChannel(expandedChannel === report.channel ? null : report.channel)}
                >
                  {/* Channel Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${report.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="font-semibold text-sm">{report.channel}</span>
                      {report.niche && <Badge variant="outline" className="text-[9px]">{report.niche}</Badge>}
                      {report.videos && <span className="text-[10px] text-muted-foreground">{report.videos} vídeos</span>}
                    </div>
                    {report.channelId && (
                      <a
                        href={`https://youtube.com/channel/${report.channelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {/* Error */}
                  {report.status === 'error' && (
                    <p className="text-xs text-red-400 mt-2">❌ {report.error}</p>
                  )}

                  {/* Expanded Summary */}
                  <AnimatePresence>
                    {expandedChannel === report.channel && report.analysis_summary && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 space-y-3 border-t border-border/50 pt-3"
                      >
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="bg-secondary/30 rounded-lg p-2 text-center">
                            <Film className="w-3.5 h-3.5 mx-auto text-primary mb-1" />
                            <p className="text-[10px] font-bold">{report.analysis_summary.content_model}</p>
                            <p className="text-[9px] text-muted-foreground">Modelo</p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-2 text-center">
                            <Eye className="w-3.5 h-3.5 mx-auto text-amber-400 mb-1" />
                            <p className="text-[10px] font-bold">{report.analysis_summary.ideas_count}</p>
                            <p className="text-[9px] text-muted-foreground">Ideias</p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-2 text-center">
                            <Film className="w-3.5 h-3.5 mx-auto text-emerald-400 mb-1" />
                            <p className="text-[10px] font-bold">{report.analysis_summary.scene_templates}</p>
                            <p className="text-[9px] text-muted-foreground">Templates Cena</p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-2 text-center">
                            <Sparkles className="w-3.5 h-3.5 mx-auto text-violet-400 mb-1" />
                            <p className="text-[10px] font-bold">{report.analysis_summary.hook_patterns?.length || 0}</p>
                            <p className="text-[9px] text-muted-foreground">Hooks</p>
                          </div>
                        </div>

                        {/* Hook patterns */}
                        {report.analysis_summary.hook_patterns?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">🎣 Padrões de Hook:</p>
                            <div className="flex flex-wrap gap-1">
                              {report.analysis_summary.hook_patterns.map((h, j) => (
                                <Badge key={j} variant="secondary" className="text-[9px]">{h}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* First 10s */}
                        {report.analysis_summary.first_10s && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">⏱️ Primeiros 10 segundos:</p>
                            <p className="text-[10px] text-foreground bg-secondary/20 rounded p-2">{report.analysis_summary.first_10s}</p>
                          </div>
                        )}

                        {/* SEO */}
                        {report.analysis_summary.seo && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">🔍 Estratégia SEO:</p>
                            <p className="text-[10px] text-foreground bg-secondary/20 rounded p-2">{report.analysis_summary.seo}</p>
                          </div>
                        )}

                        {/* Script Guide */}
                        {report.analysis_summary.script_guide && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">📝 Guia de Roteiro:</p>
                            <p className="text-[10px] text-foreground bg-secondary/20 rounded p-2">{report.analysis_summary.script_guide}</p>
                          </div>
                        )}

                        <p className="text-[9px] text-muted-foreground italic">
                          ✅ Dados salvos no sistema — disponível no Dotti, Gerador de Roteiros, Títulos e Cenas
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
