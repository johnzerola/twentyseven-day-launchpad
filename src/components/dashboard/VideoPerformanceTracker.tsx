import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Minus, Plus, RefreshCw, Eye, ThumbsUp, MessageSquare, Search, BarChart3, Target, Brain, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface VideoPerf {
  id: string;
  youtube_video_id: string;
  title: string;
  niche: string | null;
  views_current: number;
  views_day1: number;
  views_day7: number;
  views_day30: number;
  likes: number;
  comments: number;
  ctr_percent: number;
  avg_retention_percent: number;
  performance_grade: string;
  predicted_viral_score: number;
  ai_feedback: any;
  lessons_learned: string[] | null;
  best_ranking_position: number | null;
  ranking_keywords: string[];
  last_checked_at: string;
  published_at: string | null;
  created_at: string;
}

interface TitleRanking {
  id: string;
  keyword: string;
  position: number | null;
  previous_position: number | null;
  checked_at: string;
}

const GRADE_COLORS: Record<string, string> = {
  S: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  A: 'bg-green-500/20 text-green-300 border-green-500/30',
  B: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  C: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  D: 'bg-red-500/20 text-red-300 border-red-500/30',
  F: 'bg-red-800/20 text-red-400 border-red-800/30',
  pending: 'bg-muted text-muted-foreground border-muted',
};

export function VideoPerformanceTracker() {
  const [videos, setVideos] = useState<VideoPerf[]>([]);
  const [rankings, setRankings] = useState<Record<string, TitleRanking[]>>({});
  const [loading, setLoading] = useState(true);
  const [addingVideo, setAddingVideo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<VideoPerf | null>(null);

  useEffect(() => { loadVideos(); }, []);

  const loadVideos = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('video_performance')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    setVideos((data as any[]) || []);
    setLoading(false);
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  };

  const addVideo = async () => {
    const videoId = extractVideoId(newVideoUrl.trim());
    if (!videoId) { toast.error('URL inválida. Cole um link do YouTube.'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setAddingVideo(true);
    try {
      const { data, error } = await supabase.functions.invoke('track-video-performance', {
        body: { mode: 'add_video', videoId, userId: session.user.id },
      });
      if (error) throw error;
      toast.success(`"${data.title}" adicionado ao tracking!`);
      setNewVideoUrl('');
      loadVideos();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao adicionar vídeo');
    } finally {
      setAddingVideo(false);
    }
  };

  const refreshAll = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setRefreshing(true);
    try {
      await supabase.functions.invoke('track-video-performance', {
        body: { mode: 'check_all', userId: session.user.id },
      });
      toast.success('Métricas atualizadas!');
      loadVideos();
    } catch {
      toast.error('Erro ao atualizar');
    } finally {
      setRefreshing(false);
    }
  };

  const loadRankings = async (videoId: string) => {
    const { data } = await supabase
      .from('title_rankings')
      .select('*')
      .eq('video_performance_id', videoId)
      .order('checked_at', { ascending: false })
      .limit(30);
    setRankings(prev => ({ ...prev, [videoId]: (data as any[]) || [] }));
  };

  const formatViews = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const gradeStats = videos.reduce((acc, v) => {
    acc[v.performance_grade] = (acc[v.performance_grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalViews = videos.reduce((sum, v) => sum + (v.views_current || 0), 0);
  const avgGrade = videos.length > 0 
    ? videos.filter(v => v.performance_grade !== 'pending').length 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/60">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Vídeos Rastreados</div>
            <div className="text-2xl font-bold text-foreground">{videos.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Views Totais</div>
            <div className="text-2xl font-bold text-foreground">{formatViews(totalViews)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Grades S/A</div>
            <div className="text-2xl font-bold text-green-400">{(gradeStats['S'] || 0) + (gradeStats['A'] || 0)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Avaliados</div>
            <div className="text-2xl font-bold text-foreground">{avgGrade}/{videos.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Add Video */}
      <Card className="border-border/40 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" /> Adicionar Vídeo ao Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Cole a URL do YouTube (ex: https://youtube.com/watch?v=...)"
              value={newVideoUrl}
              onChange={e => setNewVideoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addVideo()}
              className="flex-1"
            />
            <Button onClick={addVideo} disabled={addingVideo || !newVideoUrl.trim()} size="sm">
              {addingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
            <Button onClick={refreshAll} disabled={refreshing} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Videos List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : videos.length === 0 ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-2">Nenhum vídeo sendo rastreado</p>
            <p className="text-xs text-muted-foreground">Adicione um vídeo publicado para começar a coletar métricas de performance e fechar o loop de aprendizado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {videos.map(video => (
            <Card key={video.id} className="border-border/40 bg-card/60 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => { setSelectedVideo(selectedVideo?.id === video.id ? null : video); if (!rankings[video.id]) loadRankings(video.id); }}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {/* Grade Badge */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold border ${GRADE_COLORS[video.performance_grade] || GRADE_COLORS.pending}`}>
                    {video.performance_grade === 'pending' ? '?' : video.performance_grade}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-foreground truncate">{video.title}</h4>
                      {video.niche && <Badge variant="outline" className="text-[10px]">{video.niche}</Badge>}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatViews(video.views_current || 0)}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{formatViews(video.likes || 0)}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{video.comments || 0}</span>
                      {video.best_ranking_position && (
                        <span className="flex items-center gap-1 text-primary"><Search className="h-3 w-3" />#{video.best_ranking_position}</span>
                      )}
                      {video.predicted_viral_score > 0 && (
                        <span className="flex items-center gap-1 opacity-70" title="Score predito por IA, não dado real"><Target className="h-3 w-3" />Pred: {video.predicted_viral_score} <span className="text-[8px]">(est.)</span></span>
                      )}
                    </div>

                    {/* View milestones */}
                    {video.views_day1 > 0 && (
                      <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span>D1: {formatViews(video.views_day1)}</span>
                        {video.views_day7 > 0 && <span>D7: {formatViews(video.views_day7)}</span>}
                        {video.views_day30 > 0 && <span>D30: {formatViews(video.views_day30)}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {selectedVideo?.id === video.id && (
                  <div className="mt-4 pt-4 border-t border-border/40 space-y-4">
                    {/* AI Feedback */}
                    {video.ai_feedback && Object.keys(video.ai_feedback).length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-medium flex items-center gap-1"><Brain className="h-3 w-3" /> Análise da IA</h5>
                        {(video.ai_feedback as any).what_worked?.length > 0 && (
                          <div>
                            <span className="text-[10px] text-green-400">✅ O que funcionou:</span>
                            <ul className="text-xs text-muted-foreground ml-4 list-disc">
                              {((video.ai_feedback as any).what_worked || []).map((w: string, i: number) => <li key={i}>{w}</li>)}
                            </ul>
                          </div>
                        )}
                        {(video.ai_feedback as any).what_failed?.length > 0 && (
                          <div>
                            <span className="text-[10px] text-red-400">❌ O que falhou:</span>
                            <ul className="text-xs text-muted-foreground ml-4 list-disc">
                              {((video.ai_feedback as any).what_failed || []).map((w: string, i: number) => <li key={i}>{w}</li>)}
                            </ul>
                          </div>
                        )}
                        {(video.ai_feedback as any).next_time && (
                          <p className="text-xs text-primary">💡 Próxima vez: {(video.ai_feedback as any).next_time}</p>
                        )}
                      </div>
                    )}

                    {/* Lessons */}
                    {video.lessons_learned && video.lessons_learned.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium mb-1">📚 Lições Aprendidas</h5>
                        <ul className="text-xs text-muted-foreground ml-4 list-disc space-y-1">
                          {video.lessons_learned.map((l, i) => <li key={i}>{l}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Rankings */}
                    {rankings[video.id] && rankings[video.id].length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium mb-2 flex items-center gap-1"><Search className="h-3 w-3" /> Rankings</h5>
                        <div className="space-y-1">
                          {rankings[video.id].slice(0, 10).map(r => (
                            <div key={r.id} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">"{r.keyword}"</span>
                              <div className="flex items-center gap-2">
                                {r.position ? (
                                  <span className={r.position <= 5 ? 'text-green-400' : r.position <= 10 ? 'text-yellow-400' : 'text-muted-foreground'}>
                                    #{r.position}
                                  </span>
                                ) : <span className="text-muted-foreground/50">—</span>}
                                {r.previous_position && r.position && (
                                  r.position < r.previous_position ? <TrendingUp className="h-3 w-3 text-green-400" /> :
                                  r.position > r.previous_position ? <TrendingDown className="h-3 w-3 text-red-400" /> :
                                  <Minus className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
