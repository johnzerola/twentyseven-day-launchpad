import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Loader2, Search, Rocket, Sparkles, Lightbulb, GripVertical, Trash2, Clock, FileText, Film, CheckCircle2, Edit3, Upload, MoreVertical, Link2, ChevronDown, ChevronUp, Eye, Wand2, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ─── Types ──────────────────────────────────────────────
type ProjectStatus = 'draft' | 'script' | 'scenes' | 'published';

interface ProjectData {
  id: string;
  title: string;
  niche: string | null;
  status: string | null;
  script: string | null;
  created_at: string | null;
  updated_at: string | null;
  duration_seconds: number | null;
  channel_id: string | null;
  scene_count: number;
  character_count: number;
}

interface UserChannel {
  id: string;
  channel_name: string;
  thumbnail: string | null;
  niche: string | null;
}

interface IdeaCard {
  id: string;
  title: string;
  priority: string | null;
  tags: string[];
  created_at: string | null;
}

interface AIIdea {
  title: string;
  concept: string;
  priority: string;
  hook: string;
}

// ─── Constants ──────────────────────────────────────────
const PIPELINE_COLUMNS = [
  { id: 'draft', title: 'Ideias & Rascunhos', emoji: '💡', icon: Edit3, color: 'border-t-yellow-500' },
  { id: 'script', title: 'Roteiro Pronto', emoji: '✍️', icon: FileText, color: 'border-t-violet-500' },
  { id: 'scenes', title: 'Cenas Geradas', emoji: '🎬', icon: Film, color: 'border-t-blue-500' },
  { id: 'published', title: 'Publicado', emoji: '✅', icon: CheckCircle2, color: 'border-t-emerald-500' },
];

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-yellow-500/20 text-yellow-400' },
  script: { label: 'Roteiro', color: 'bg-violet-500/20 text-violet-400' },
  scenes: { label: 'Cenas', color: 'bg-blue-500/20 text-blue-400' },
  published: { label: 'Publicado', color: 'bg-emerald-500/20 text-emerald-400' },
};

const PRIORITY_COLORS: Record<string, string> = {
  alta: 'bg-destructive/20 text-destructive border-destructive/30',
  média: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  baixa: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

// ─── Main Component ─────────────────────────────────────
const Workflow = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [channels, setChannels] = useState<UserChannel[]>([]);
  const [ideas, setIdeas] = useState<IdeaCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draggedCard, setDraggedCard] = useState<{ id: string; from: string } | null>(null);

  // New project dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNiche, setNewNiche] = useState('');
  const [newChannelId, setNewChannelId] = useState('');
  const [creating, setCreating] = useState(false);

  // Quick idea
  const [quickIdea, setQuickIdea] = useState('');
  const [addingIdea, setAddingIdea] = useState(false);

  // AI ideas
  const [aiNiche, setAiNiche] = useState('');
  const [aiIdeas, setAiIdeas] = useState<AIIdea[]>([]);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiMeta, setAiMeta] = useState({ viral: 0, channels: 0 });

  // ─── Data Loading ───────────────────────────────────
  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [projRes, channelRes, ideasRes] = await Promise.all([
      supabase.from('video_projects').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).range(0, 49),
      supabase.from('user_channels').select('id, channel_name, thumbnail, niche').eq('user_id', user.id),
      supabase.from('planner_cards').select('*').eq('user_id', user.id).eq('column_id', 'ideas').order('created_at', { ascending: false }).range(0, 49),
    ]);

    setChannels(channelRes.data || []);
    setIdeas((ideasRes.data || []).map((c: any) => ({
      id: c.id, title: c.title, priority: c.priority,
      tags: Array.isArray(c.tags) ? c.tags as string[] : [],
      created_at: c.created_at,
    })));

    const projs = projRes.data || [];
    if (projs.length > 0) {
      const ids = projs.map(p => p.id);
      const [sceneRes, charRes] = await Promise.all([
        supabase.from('scenes').select('project_id').in('project_id', ids),
        supabase.from('characters').select('project_id').in('project_id', ids),
      ]);
      const sceneCounts: Record<string, number> = {};
      (sceneRes.data || []).forEach(s => { sceneCounts[s.project_id] = (sceneCounts[s.project_id] || 0) + 1; });
      const charCounts: Record<string, number> = {};
      (charRes.data || []).forEach(c => { charCounts[c.project_id] = (charCounts[c.project_id] || 0) + 1; });

      const enriched: ProjectData[] = projs.map(p => {
        const sc = sceneCounts[p.id] || 0;
        const cc = charCounts[p.id] || 0;
        const hasScript = !!p.script && p.script.length > 50;
        let autoStatus = p.status || 'draft';
        if (sc > 0 && (autoStatus === 'draft' || autoStatus === 'script')) autoStatus = 'scenes';
        else if (hasScript && autoStatus === 'draft') autoStatus = 'script';
        if (autoStatus !== p.status) {
          supabase.from('video_projects').update({ status: autoStatus, updated_at: new Date().toISOString() }).eq('id', p.id).then();
        }
        return { ...p, status: autoStatus, scene_count: sc, character_count: cc, channel_id: (p as any).channel_id || null };
      });
      setProjects(enriched);
    } else {
      setProjects([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Actions ────────────────────────────────────────
  const createProject = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const obj: any = { user_id: user.id, title: newTitle.trim(), niche: newNiche.trim() || null, status: 'draft' };
    if (newChannelId && newChannelId !== 'none') obj.channel_id = newChannelId;
    const { error } = await supabase.from('video_projects').insert(obj).select().single();
    if (error) { toast.error('Erro ao criar projeto'); setCreating(false); return; }
    toast.success('Projeto criado!');
    setNewTitle(''); setNewNiche(''); setNewChannelId(''); setDialogOpen(false); setCreating(false);
    loadData();
  };

  const deleteProject = async (id: string) => {
    await supabase.from('video_projects').delete().eq('id', id);
    setProjects(prev => prev.filter(p => p.id !== id));
    toast.success('Projeto removido');
  };

  const updateStatus = async (id: string, status: ProjectStatus) => {
    await supabase.from('video_projects').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    toast.success(`Status: ${STATUS_CONFIG[status].label}`);
  };

  const linkChannel = async (projectId: string, channelId: string | null) => {
    await supabase.from('video_projects').update({ channel_id: channelId, updated_at: new Date().toISOString() } as any).eq('id', projectId);
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, channel_id: channelId } : p));
    toast.success(channelId ? 'Canal vinculado' : 'Canal desvinculado');
  };

  const handleDrop = async (toStatus: string) => {
    if (!draggedCard || draggedCard.from === toStatus) { setDraggedCard(null); return; }
    await updateStatus(draggedCard.id, toStatus as ProjectStatus);
    setDraggedCard(null);
  };

  // Quick idea
  const addQuickIdea = async () => {
    if (!quickIdea.trim()) return;
    setAddingIdea(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddingIdea(false); return; }
    await supabase.from('planner_cards').insert({
      user_id: user.id, column_id: 'ideas', title: quickIdea.trim(), priority: 'média', position: 0,
    } as any);
    setQuickIdea('');
    setAddingIdea(false);
    loadData();
    toast.success('Ideia salva!');
  };

  const deleteIdea = async (id: string) => {
    await supabase.from('planner_cards').delete().eq('id', id);
    setIdeas(prev => prev.filter(i => i.id !== id));
    toast.success('Ideia removida');
  };

  const promoteIdeaToProject = async (idea: IdeaCard) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('video_projects').insert({ user_id: user.id, title: idea.title, status: 'draft' } as any);
    await supabase.from('planner_cards').delete().eq('id', idea.id);
    toast.success('Ideia promovida a projeto!');
    loadData();
  };

  // AI ideas
  const generateAIIdeas = async () => {
    if (!aiNiche.trim()) { toast.error('Digite um nicho'); return; }
    setGeneratingAI(true);
    setAiIdeas([]);
    try {
      const existingTitles = [...ideas.map(i => i.title), ...projects.map(p => p.title)];
      const { data, error } = await supabase.functions.invoke('generate-ideas', {
        body: { niche: aiNiche.trim(), existingIdeas: existingTitles, count: 6 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiIdeas(data.ideas || []);
      setAiMeta({ viral: data.viral_count || 0, channels: data.channel_count || 0 });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar ideias');
    }
    setGeneratingAI(false);
  };

  const saveAIIdea = async (idea: AIIdea) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('planner_cards').insert({
      user_id: user.id, column_id: 'ideas', title: idea.title, priority: idea.priority, position: 0,
      tags: [idea.hook],
    } as any);
    toast.success('Ideia salva!');
    loadData();
  };

  const saveAIIdeaAsProject = async (idea: AIIdea) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('video_projects').insert({
      user_id: user.id, title: idea.title, niche: aiNiche.trim(), status: 'draft',
    } as any);
    toast.success('Projeto criado a partir da ideia!');
    loadData();
  };

  // ─── Computed ───────────────────────────────────────
  const getColumnProjects = (statusId: string) => {
    return projects.filter(p => {
      const s = p.status || 'draft';
      if (s !== statusId) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  };

  const stats = {
    total: projects.length,
    ideas: ideas.length,
    draft: projects.filter(p => p.status === 'draft').length,
    script: projects.filter(p => p.status === 'script').length,
    scenes: projects.filter(p => p.status === 'scenes').length,
    published: projects.filter(p => p.status === 'published').length,
  };

  if (loading) {
    return <DashboardLayout><KanbanSkeleton /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-full mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Rocket className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">Production Hub</h1>
              <p className="text-muted-foreground text-sm">
                {stats.total} projetos • {stats.ideas} ideias salvas
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-10 bg-secondary/50 h-9" />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-hero border-0 gap-2 h-9"><Plus className="w-4 h-4" /> Novo Projeto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Criar Novo Projeto</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium text-foreground">Título do vídeo</label>
                    <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Os 5 Maiores Mistérios" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Nicho (opcional)</label>
                    <Input value={newNiche} onChange={e => setNewNiche(e.target.value)} placeholder="Ex: true crime, horror..." className="mt-1" />
                  </div>
                  {channels.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-foreground">Canal</label>
                      <Select value={newChannelId} onValueChange={setNewChannelId}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar canal..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {channels.map(ch => <SelectItem key={ch.id} value={ch.id}>{ch.channel_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button onClick={createProject} disabled={creating || !newTitle.trim()} className="w-full gradient-hero border-0">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Criar Projeto
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'Ideias', value: stats.ideas, color: 'text-yellow-400' },
            { label: 'Rascunhos', value: stats.draft, color: 'text-muted-foreground' },
            { label: 'Roteiro', value: stats.script, color: 'text-violet-400' },
            { label: 'Cenas', value: stats.scenes, color: 'text-blue-400' },
            { label: 'Publicados', value: stats.published, color: 'text-emerald-400' },
            { label: 'Total', value: stats.total, color: 'text-foreground' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-2.5 text-center">
              <p className={`text-lg font-bold font-['Space_Grotesk'] ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs: Pipeline | Banco de Ideias */}
        <Tabs defaultValue="pipeline" className="space-y-4">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="pipeline" className="gap-1.5"><Rocket className="w-3.5 h-3.5" /> Pipeline</TabsTrigger>
            <TabsTrigger value="ideas" className="gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Banco de Ideias</TabsTrigger>
          </TabsList>

          {/* ═══ PIPELINE TAB ═══ */}
          <TabsContent value="pipeline" className="mt-0">
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
              {PIPELINE_COLUMNS.map(col => {
                const colProjects = getColumnProjects(col.id);
                return (
                  <div key={col.id} className="flex-shrink-0 w-72 md:w-80"
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary/30', 'rounded-xl'); }}
                    onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-primary/30', 'rounded-xl'); }}
                    onDrop={e => { e.currentTarget.classList.remove('ring-2', 'ring-primary/30', 'rounded-xl'); handleDrop(col.id); }}>
                    <div className={`bg-card border border-border rounded-xl p-3 min-h-[400px] border-t-2 ${col.color}`}>
                      <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                          <span>{col.emoji}</span> {col.title}
                        </h3>
                        <Badge variant="secondary" className="text-[10px]">{colProjects.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {colProjects.map((project, i) => (
                          <PipelineCard key={project.id} project={project} index={i} channels={channels}
                            onDragStart={() => setDraggedCard({ id: project.id, from: col.id })}
                            onDelete={deleteProject} onUpdateStatus={updateStatus} onLinkChannel={linkChannel} />
                        ))}
                        {colProjects.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground/30">
                            <col.icon className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-xs">Arraste projetos aqui</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ═══ IDEAS TAB ═══ */}
          <TabsContent value="ideas" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Quick Ideas + Saved */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" /> Anotar Ideia Rápida
                  </h3>
                  <div className="flex gap-2">
                    <Input value={quickIdea} onChange={e => setQuickIdea(e.target.value)}
                      placeholder="Escreva sua ideia de vídeo..." className="bg-secondary/50"
                      onKeyDown={e => e.key === 'Enter' && addQuickIdea()} />
                    <Button onClick={addQuickIdea} disabled={addingIdea} size="sm" className="gradient-hero border-0 shrink-0">
                      {addingIdea ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    📋 Ideias Salvas ({ideas.length})
                  </h3>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {ideas.map(idea => (
                      <motion.div key={idea.id} layout className="bg-secondary/50 rounded-lg p-3 group hover:bg-secondary/80 transition-all border border-transparent hover:border-primary/20">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground line-clamp-2">{idea.title}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {idea.priority && (
                                <Badge variant="outline" className={`text-[9px] ${PRIORITY_COLORS[idea.priority] || ''}`}>
                                  {idea.priority}
                                </Badge>
                              )}
                              {idea.tags.map(t => (
                                <span key={t} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{t}</span>
                              ))}
                              {idea.created_at && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(idea.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Promover a projeto"
                              onClick={() => promoteIdeaToProject(idea)}>
                              <ArrowRight className="w-3 h-3 text-primary" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteIdea(idea.id)}>
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {ideas.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground/40">
                        <Lightbulb className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs">Nenhuma ideia salva ainda</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: AI Ideas */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Gerador de Ideias com IA
                </h3>
                <p className="text-xs text-muted-foreground">
                  A IA analisa títulos virais e canais de sucesso do seu nicho para sugerir ideias com alto potencial.
                </p>
                <div className="flex gap-2">
                  <Input value={aiNiche} onChange={e => setAiNiche(e.target.value)}
                    placeholder="Digite o nicho (ex: true crime, horror...)" className="bg-secondary/50"
                    onKeyDown={e => e.key === 'Enter' && generateAIIdeas()} />
                  <Button onClick={generateAIIdeas} disabled={generatingAI} className="gradient-hero border-0 shrink-0 gap-1.5">
                    {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Gerar
                  </Button>
                </div>

                {aiMeta.viral > 0 && (
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-[10px]">📊 {aiMeta.viral} títulos virais analisados</Badge>
                    <Badge variant="secondary" className="text-[10px]">📡 {aiMeta.channels} canais de referência</Badge>
                  </div>
                )}

                <div className="space-y-2 max-h-[450px] overflow-y-auto">
                  {generatingAI && (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Analisando padrões virais e gerando ideias...</p>
                    </div>
                  )}
                  {aiIdeas.map((idea, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="bg-secondary/50 rounded-lg p-3 border border-border hover:border-primary/20 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{idea.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{idea.concept}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className={`text-[9px] ${PRIORITY_COLORS[idea.priority] || ''}`}>
                              {idea.priority}
                            </Badge>
                            <span className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">🎣 {idea.hook}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => saveAIIdea(idea)}>
                            <Lightbulb className="w-3 h-3" /> Salvar
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => saveAIIdeaAsProject(idea)}>
                            <Rocket className="w-3 h-3" /> Projeto
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {!generatingAI && aiIdeas.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground/40">
                      <Sparkles className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-xs">Digite um nicho e clique Gerar para receber ideias baseadas em dados reais</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

// ─── Pipeline Card Component ────────────────────────────
const PipelineCard = ({ project, index, channels, onDragStart, onDelete, onUpdateStatus, onLinkChannel }: {
  project: ProjectData; index: number; channels: UserChannel[];
  onDragStart: () => void; onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: ProjectStatus) => void;
  onLinkChannel: (id: string, channelId: string | null) => void;
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const status = (project.status || 'draft') as ProjectStatus;
  const config = STATUS_CONFIG[status];
  const hasScript = !!project.script && project.script.length > 50;
  const hasScenes = project.scene_count > 0;
  const linkedChannel = channels.find(c => c.id === project.channel_id);

  const getNextAction = () => {
    if (status === 'draft') return { label: 'Criar Roteiro', icon: FileText, action: () => navigate(`/scripts?projectId=${project.id}&niche=${encodeURIComponent(project.niche || '')}`) };
    if (status === 'script' && hasScript) return { label: 'Gerar Cenas', icon: Film, action: () => navigate(`/scripts?projectId=${project.id}`) };
    if (status === 'scenes') return { label: 'Abrir Studio', icon: Wand2, action: () => navigate(`/scripts?projectId=${project.id}`) };
    return null;
  };
  const nextAction = getNextAction();

  return (
    <motion.div layout draggable onDragStart={onDragStart}
      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }}
      className="bg-secondary/50 rounded-lg cursor-grab active:cursor-grabbing hover:bg-secondary/80 transition-all border border-transparent hover:border-primary/20 group">
      <div className="p-3" onClick={() => setExpanded(p => !p)}>
        <div className="flex items-start gap-2">
          <GripVertical className="w-3 h-3 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground line-clamp-2">{project.title || 'Sem título'}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {linkedChannel && (
                <Badge variant="secondary" className="text-[9px] gap-1">
                  {linkedChannel.thumbnail && <img src={linkedChannel.thumbnail} className="w-3 h-3 rounded-full" alt="" />}
                  {linkedChannel.channel_name}
                </Badge>
              )}
              {project.niche && <Badge variant="outline" className="text-[9px]">{project.niche}</Badge>}
              {hasScript && <FileText className="w-3 h-3 text-violet-400" />}
              {hasScenes && <span className="text-[9px] text-blue-400 flex items-center gap-0.5"><Film className="w-3 h-3" />{project.scene_count}</span>}
              {project.character_count > 0 && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{project.character_count}</span>}
            </div>
            {project.updated_at && (
              <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5 mt-1">
                <Clock className="w-2.5 h-2.5" /> {new Date(project.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Mover para</DropdownMenuLabel>
                {PIPELINE_COLUMNS.map(col => (
                  <DropdownMenuItem key={col.id} onClick={() => onUpdateStatus(project.id, col.id as ProjectStatus)}
                    className={status === col.id ? 'bg-primary/10' : ''}>
                    <col.icon className="w-3.5 h-3.5 mr-2" /> {col.title}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Canal</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onLinkChannel(project.id, null)} className={!project.channel_id ? 'bg-primary/10' : ''}>
                  <Link2 className="w-3.5 h-3.5 mr-2" /> Nenhum
                </DropdownMenuItem>
                {channels.map(ch => (
                  <DropdownMenuItem key={ch.id} onClick={() => onLinkChannel(project.id, ch.id)}
                    className={project.channel_id === ch.id ? 'bg-primary/10' : ''}>
                    {ch.thumbnail && <img src={ch.thumbnail} className="w-3.5 h-3.5 rounded-full mr-2" alt="" />}
                    {ch.channel_name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(project.id)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Deletar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Expanded actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="border-t border-border px-3 py-2 space-y-2 bg-card/50">
              {hasScript && (
                <p className="text-[10px] text-muted-foreground line-clamp-3 bg-background rounded p-2">
                  {project.script!.slice(0, 200)}...
                </p>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {nextAction && (
                  <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={nextAction.action}>
                    <nextAction.icon className="w-3 h-3" /> {nextAction.label}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
                  onClick={() => navigate(`/scripts?projectId=${project.id}`)}>
                  <Eye className="w-3 h-3" /> Abrir
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Workflow;
