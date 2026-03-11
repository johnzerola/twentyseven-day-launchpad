import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderOpen, Film, FileText, Wand2, Upload, Loader2, Trash2, ChevronRight, Clock, Eye, Users, MoreVertical, Search, Filter, Rocket, Edit3, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatters';

type ProjectStatus = 'draft' | 'script' | 'scenes' | 'published';

interface Project {
  id: string;
  title: string;
  niche: string | null;
  status: string | null;
  script: string | null;
  created_at: string | null;
  updated_at: string | null;
  duration_seconds: number | null;
  scene_count?: number;
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: React.ElementType; step: number }> = {
  draft: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: Edit3, step: 1 },
  script: { label: 'Roteiro Pronto', color: 'bg-primary/20 text-primary', icon: FileText, step: 2 },
  scenes: { label: 'Cenas Geradas', color: 'bg-accent/20 text-accent', icon: Film, step: 3 },
  published: { label: 'Publicado', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle2, step: 4 },
};

const STEPS = [
  { key: 'draft', label: 'Ideia', icon: Edit3 },
  { key: 'script', label: 'Roteiro', icon: FileText },
  { key: 'scenes', label: 'Cenas', icon: Film },
  { key: 'published', label: 'Publicado', icon: Upload },
];

const Workflow = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newNiche, setNewNiche] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: projs } = await supabase
      .from('video_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (projs) {
      // Get scene counts
      const ids = projs.map(p => p.id);
      const sceneCounts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: scenes } = await supabase
          .from('scenes')
          .select('project_id')
          .in('project_id', ids);
        (scenes || []).forEach(s => {
          sceneCounts[s.project_id] = (sceneCounts[s.project_id] || 0) + 1;
        });
      }
      setProjects(projs.map(p => ({ ...p, scene_count: sceneCounts[p.id] || 0 })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const createProject = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { data, error } = await supabase.from('video_projects').insert({
      user_id: user.id,
      title: newTitle.trim(),
      niche: newNiche.trim() || null,
      status: 'draft',
    }).select().single();

    if (error) { toast.error('Erro ao criar projeto'); setCreating(false); return; }
    toast.success('Projeto criado!');
    setNewTitle('');
    setNewNiche('');
    setDialogOpen(false);
    setCreating(false);
    loadProjects();
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('video_projects').delete().eq('id', id);
    if (error) return toast.error('Erro ao deletar');
    setProjects(prev => prev.filter(p => p.id !== id));
    toast.success('Projeto removido');
  };

  const updateStatus = async (id: string, status: ProjectStatus) => {
    await supabase.from('video_projects').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    toast.success(`Status: ${STATUS_CONFIG[status].label}`);
  };

  const filtered = projects.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !(p.niche || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusCounts = {
    all: projects.length,
    draft: projects.filter(p => p.status === 'draft').length,
    script: projects.filter(p => p.status === 'script').length,
    scenes: projects.filter(p => p.status === 'scenes').length,
    published: projects.filter(p => p.status === 'published').length,
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Rocket className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">Project Workspace</h1>
              <p className="text-muted-foreground text-sm">{projects.length} projetos · Pipeline completo da ideia à publicação</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-hero border-0 gap-2">
                <Plus className="w-4 h-4" /> Novo Projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Projeto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Título do vídeo</label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Os 5 Maiores Mistérios Não Resolvidos" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Nicho (opcional)</label>
                  <Input value={newNiche} onChange={e => setNewNiche(e.target.value)} placeholder="Ex: true crime, finanças, horror..." className="mt-1" />
                </div>
                <Button onClick={createProject} disabled={creating || !newTitle.trim()} className="w-full gradient-hero border-0">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Criar Projeto
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { key: 'all', label: 'Todos', count: statusCounts.all, color: 'text-foreground' },
            { key: 'draft', label: 'Rascunhos', count: statusCounts.draft, color: 'text-muted-foreground' },
            { key: 'script', label: 'Com Roteiro', count: statusCounts.script, color: 'text-primary' },
            { key: 'scenes', label: 'Com Cenas', count: statusCounts.scenes, color: 'text-accent' },
            { key: 'published', label: 'Publicados', count: statusCounts.published, color: 'text-emerald-400' },
          ].map(s => (
            <button key={s.key} onClick={() => setFilter(s.key)}
              className={`rounded-xl p-3 text-center transition-all ${filter === s.key ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-card hover:bg-card/80'}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar projetos por título ou nicho..."
            className="pl-10 bg-secondary/50" />
        </div>

        {/* Pipeline View */}
        <div className="grid grid-cols-4 gap-1 bg-secondary/30 rounded-xl p-1">
          {STEPS.map((step, i) => {
            const count = projects.filter(p => p.status === step.key).length;
            return (
              <div key={step.key} className="flex items-center gap-2 px-3 py-2 rounded-lg">
                <step.icon className={`w-4 h-4 ${count > 0 ? 'text-primary' : 'text-muted-foreground/50'}`} />
                <span className="text-xs text-muted-foreground">{step.label}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{count}</Badge>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
              </div>
            );
          })}
        </div>

        {/* Projects List */}
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((project, i) => {
              const status = (project.status || 'draft') as ProjectStatus;
              const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
              const hasScript = !!project.script && project.script.length > 50;
              const hasScenes = (project.scene_count || 0) > 0;
              const progressValue = config.step * 25;

              return (
                <motion.div key={project.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-all group">
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
                      <config.icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground truncate">{project.title || 'Sem título'}</h3>
                        <Badge className={`text-[9px] shrink-0 ${config.color}`}>{config.label}</Badge>
                        {project.niche && <Badge variant="outline" className="text-[9px] shrink-0">{project.niche}</Badge>}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {project.updated_at ? new Date(project.updated_at).toLocaleDateString('pt-BR') : '—'}
                        </span>
                        {hasScript && <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-primary" /> Roteiro</span>}
                        {hasScenes && <span className="flex items-center gap-1"><Film className="w-3 h-3 text-accent" /> {project.scene_count} cenas</span>}
                        {project.duration_seconds ? <span>{Math.round(project.duration_seconds / 60)} min</span> : null}
                      </div>

                      <Progress value={progressValue} className="h-1.5" />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {status === 'draft' && (
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
                          onClick={() => navigate(`/scripts?projectId=${project.id}&niche=${encodeURIComponent(project.niche || '')}`)}>
                          <FileText className="w-3 h-3" /> Criar Roteiro
                        </Button>
                      )}
                      {status === 'script' && hasScript && (
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
                          onClick={() => navigate(`/scripts?projectId=${project.id}`)}>
                          <Film className="w-3 h-3" /> Gerar Cenas
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                            <DropdownMenuItem key={key} onClick={() => updateStatus(project.id, key as ProjectStatus)}
                              className={status === key ? 'bg-primary/10' : ''}>
                              <val.icon className="w-3.5 h-3.5 mr-2" /> {val.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem onClick={() => deleteProject(project.id)} className="text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-15" />
              <p className="text-lg font-semibold mb-1">
                {projects.length === 0 ? 'Nenhum projeto ainda' : 'Nenhum projeto com este filtro'}
              </p>
              <p className="text-sm mb-4">Crie seu primeiro projeto para começar o pipeline de produção</p>
              <Button onClick={() => setDialogOpen(true)} className="gradient-hero border-0 gap-2">
                <Plus className="w-4 h-4" /> Criar Primeiro Projeto
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Workflow;
