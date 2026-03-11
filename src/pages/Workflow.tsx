import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AnimatePresence } from 'framer-motion';
import { Plus, FolderOpen, Loader2, Search, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WorkspaceStats } from '@/components/workspace/WorkspaceStats';
import { ProjectCard, ProjectData, ProjectStatus, STATUS_CONFIG } from '@/components/workspace/ProjectCard';

interface UserChannel {
  id: string;
  channel_name: string;
  thumbnail: string | null;
  niche: string | null;
}

const Workflow = () => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [channels, setChannels] = useState<UserChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newNiche, setNewNiche] = useState('');
  const [newChannelId, setNewChannelId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Load projects, scenes, characters, channels in parallel
    const [projRes, channelRes] = await Promise.all([
      supabase.from('video_projects').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('user_channels').select('id, channel_name, thumbnail, niche').eq('user_id', user.id),
    ]);

    const projs = projRes.data || [];
    setChannels(channelRes.data || []);

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

      // Auto-status detection
      const enriched: ProjectData[] = projs.map(p => {
        const sceneCount = sceneCounts[p.id] || 0;
        const charCount = charCounts[p.id] || 0;
        const hasScript = !!p.script && p.script.length > 50;
        let autoStatus = p.status || 'draft';

        if (sceneCount > 0 && autoStatus === 'draft') autoStatus = 'scenes';
        else if (sceneCount > 0 && autoStatus === 'script') autoStatus = 'scenes';
        else if (hasScript && autoStatus === 'draft') autoStatus = 'script';

        // Update if auto-detected status is different
        if (autoStatus !== p.status) {
          supabase.from('video_projects').update({ status: autoStatus, updated_at: new Date().toISOString() }).eq('id', p.id).then();
        }

        return {
          ...p,
          status: autoStatus,
          scene_count: sceneCount,
          character_count: charCount,
          channel_id: (p as any).channel_id || null,
        };
      });

      setProjects(enriched);
    } else {
      setProjects([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const createProject = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const insertObj: any = {
      user_id: user.id,
      title: newTitle.trim(),
      niche: newNiche.trim() || null,
      status: 'draft',
    };
    if (newChannelId && newChannelId !== 'none') insertObj.channel_id = newChannelId;

    const { error } = await supabase.from('video_projects').insert(insertObj).select().single();
    if (error) { toast.error('Erro ao criar projeto'); setCreating(false); return; }
    toast.success('Projeto criado!');
    setNewTitle(''); setNewNiche(''); setNewChannelId('');
    setDialogOpen(false); setCreating(false);
    loadData();
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

  const linkChannel = async (projectId: string, channelId: string | null) => {
    await supabase.from('video_projects').update({ channel_id: channelId, updated_at: new Date().toISOString() } as any).eq('id', projectId);
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, channel_id: channelId } : p));
    toast.success(channelId ? 'Canal vinculado' : 'Canal desvinculado');
  };

  // Filtering
  const filtered = projects.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (channelFilter !== 'all' && p.channel_id !== channelFilter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !(p.niche || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = projects.filter(p => p.created_at && new Date(p.created_at) >= weekAgo).length;
  const withScript = projects.filter(p => p.script && p.script.length > 50).length;
  const withScenes = projects.filter(p => p.scene_count > 0).length;
  const published = projects.filter(p => p.status === 'published').length;

  // Status filter pills
  const statusFilters = [
    { key: 'all', label: 'Todos', count: projects.length },
    { key: 'draft', label: 'Rascunho', count: projects.filter(p => p.status === 'draft').length },
    { key: 'script', label: 'Roteiro', count: projects.filter(p => p.status === 'script').length },
    { key: 'scenes', label: 'Cenas', count: projects.filter(p => p.status === 'scenes').length },
    { key: 'published', label: 'Publicado', count: projects.filter(p => p.status === 'published').length },
  ];

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
              <p className="text-muted-foreground text-sm">Pipeline completo da ideia à publicação</p>
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
                {channels.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-foreground">Canal (opcional)</label>
                    <Select value={newChannelId} onValueChange={setNewChannelId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecionar canal..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {channels.map(ch => (
                          <SelectItem key={ch.id} value={ch.id}>{ch.channel_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={createProject} disabled={creating || !newTitle.trim()} className="w-full gradient-hero border-0">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Criar Projeto
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <WorkspaceStats total={projects.length} thisWeek={thisWeek} withScript={withScript} withScenes={withScenes} published={published} />

        {/* Filters Row */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex gap-1.5 flex-wrap flex-1">
            {statusFilters.map(sf => (
              <button key={sf.key} onClick={() => setFilter(sf.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === sf.key ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                {sf.label} <span className="ml-1 opacity-60">{sf.count}</span>
              </button>
            ))}
          </div>
          {channels.length > 0 && (
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Filtrar por canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                {channels.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.channel_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar projetos por título ou nicho..."
            className="pl-10 bg-secondary/50" />
        </div>

        {/* Projects List */}
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((project, i) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={i}
                channels={channels}
                onDelete={deleteProject}
                onUpdateStatus={updateStatus}
                onLinkChannel={linkChannel}
              />
            ))}
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
