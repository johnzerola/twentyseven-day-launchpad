import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Plus, Search, Filter, Globe, Calendar, Trash2, Edit3,
  BarChart3, TrendingUp, Youtube, FolderOpen, CheckCircle2,
  Clock, Sparkles, ChevronDown, ChevronUp, GripVertical,
  Copy, ArrowRight, Loader2, FileText, Users, Kanban, Lightbulb, Wand2, Star,
  Flame, ExternalLink, Zap, Brain, Target
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth-fetch';
import { Progress } from '@/components/ui/progress';

type QueueItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  channel_id: string | null;
  niche: string | null;
  language: string;
  country: string;
  scheduled_date: string | null;
  notes: string;
  tags: string[];
  created_at: string;
};

type Channel = {
  id: string;
  channel_name: string;
  youtube_channel_id: string;
  subscribers: number;
  views: number;
  videos: number;
  thumbnail: string | null;
  niche: string | null;
};

type ChannelGroup = {
  id: string;
  name: string;
  description: string;
  color: string;
  channels: string[];
  default_language: string;
  default_country: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  idea: { label: '💡 Ideia', color: 'bg-muted text-muted-foreground', icon: Sparkles },
  scripting: { label: '📝 Roteiro', color: 'bg-blue-500/20 text-blue-400', icon: FileText },
  producing: { label: '🎬 Produção', color: 'bg-amber-500/20 text-amber-400', icon: Clock },
  scheduled: { label: '📅 Agendado', color: 'bg-purple-500/20 text-purple-400', icon: Calendar },
  published: { label: '✅ Publicado', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle2 },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-muted-foreground/30',
  medium: 'border-primary/30',
  high: 'border-amber-500/50',
  urgent: 'border-destructive/50',
};

const MultiChannel = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [groups, setGroups] = useState<ChannelGroup[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'groups'>('overview');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDate, setNewDate] = useState('');

  // Group form
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupChannels, setNewGroupChannels] = useState<string[]>([]);

  // Idea generator
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [showIdeaPanel, setShowIdeaPanel] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [chRes, qRes, gRes] = await Promise.all([
      supabase.from('user_channels').select('*').eq('user_id', user.id).order('linked_at', { ascending: false }),
      supabase.from('content_queue').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('channel_groups').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    setChannels((chRes.data || []) as any);
    setQueue((qRes.data || []).map((q: any) => ({ ...q, tags: Array.isArray(q.tags) ? q.tags : [] })));
    setGroups((gRes.data || []).map((g: any) => ({ ...g, channels: Array.isArray(g.channels) ? g.channels : [] })));
    setLoading(false);
  };

  const generateIdeas = async () => {
    const selectedChannel = channels.find(c => c.id === newChannel);
    if (!selectedChannel) { toast.error('Selecione um canal primeiro'); return; }
    setGeneratingIdeas(true);
    setShowIdeaPanel(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ideas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          niche: selectedChannel.niche || 'general',
          channelName: selectedChannel.channel_name,
          count: 8,
        }),
      });
      const result = await res.json();
      if (result.ideas) {
        setGeneratedIdeas(result.ideas);
      } else {
        toast.error(result.error || 'Erro ao gerar ideias');
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setGeneratingIdeas(false);
    }
  };

  const selectIdea = (idea: any) => {
    setNewTitle(idea.title || idea.tema || '');
    setShowIdeaPanel(false);
    toast.success('💡 Ideia selecionada!');
  };

  const addQueueItem = async () => {
    if (!newTitle.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('content_queue').insert({
      user_id: user.id,
      title: newTitle.trim(),
      channel_id: newChannel || null,
      priority: newPriority,
      scheduled_date: newDate || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Item adicionado à fila!');
    setNewTitle(''); setNewChannel(''); setNewDate(''); setShowAddForm(false);
    loadAll();
  };

  const updateQueueStatus = async (id: string, status: string) => {
    await supabase.from('content_queue').update({ status, updated_at: new Date().toISOString() } as any).eq('id', id);
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    toast.success(`Status → ${STATUS_CONFIG[status]?.label || status}`);
  };

  const deleteQueueItem = async (id: string) => {
    await supabase.from('content_queue').delete().eq('id', id);
    setQueue(prev => prev.filter(q => q.id !== id));
    toast.success('Removido da fila');
  };

  const duplicateToChannels = async (item: QueueItem, targetChannelIds: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const inserts = targetChannelIds.map(chId => ({
      user_id: user.id,
      title: item.title,
      channel_id: chId,
      priority: item.priority,
      niche: item.niche,
      notes: `Rollout de: ${item.title}`,
      status: 'idea',
    }));
    const { error } = await supabase.from('content_queue').insert(inserts as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`📋 Rollout para ${targetChannelIds.length} canais!`);
    loadAll();
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('channel_groups').insert({
      user_id: user.id,
      name: newGroupName.trim(),
      channels: newGroupChannels,
    } as any);
    toast.success('Grupo criado!');
    setNewGroupName(''); setNewGroupChannels([]); setShowGroupForm(false);
    loadAll();
  };

  const deleteGroup = async (id: string) => {
    await supabase.from('channel_groups').delete().eq('id', id);
    setGroups(prev => prev.filter(g => g.id !== id));
    toast.success('Grupo removido');
  };

  // Filtered queue
  const filtered = queue.filter(q => {
    if (filterStatus !== 'all' && q.status !== filterStatus) return false;
    if (filterChannel !== 'all' && q.channel_id !== filterChannel) return false;
    if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Stats
  const statsByStatus = Object.keys(STATUS_CONFIG).map(s => ({
    status: s,
    ...STATUS_CONFIG[s],
    count: queue.filter(q => q.status === s).length,
  }));

  const channelName = (id: string | null) => channels.find(c => c.id === id)?.channel_name || '—';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Multichannel Manager</h1>
              <p className="text-sm text-muted-foreground">{channels.length} canais • {queue.length} na fila</p>
            </div>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
            <Plus className="w-4 h-4" /> Adicionar Conteúdo
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-2">
          {statsByStatus.map(s => (
            <button key={s.status} onClick={() => setFilterStatus(filterStatus === s.status ? 'all' : s.status)}
              className={`rounded-xl p-3 border transition-all text-center ${
                filterStatus === s.status ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/30'
              }`}>
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" /> Novo item na fila
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título do vídeo / ideia (ou gere abaixo)" className="bg-muted/30" />
                  </div>
                  <select value={newChannel} onChange={e => { setNewChannel(e.target.value); setGeneratedIdeas([]); setShowIdeaPanel(false); }}
                    className="h-9 rounded-md border border-input bg-muted/30 px-3 text-sm">
                    <option value="">Selecione canal</option>
                    {channels.map(c => <option key={c.id} value={c.id}>{c.channel_name} {c.niche ? `(${c.niche})` : ''}</option>)}
                  </select>
                  <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
                    className="h-9 rounded-md border border-input bg-muted/30 px-3 text-sm">
                    <option value="low">🟢 Baixa</option>
                    <option value="medium">🟡 Média</option>
                    <option value="high">🟠 Alta</option>
                    <option value="urgent">🔴 Urgente</option>
                  </select>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="bg-muted/30 w-48" />
                  <Button onClick={generateIdeas} disabled={!newChannel || generatingIdeas} variant="outline" className="gap-1.5 text-xs">
                    {generatingIdeas ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    {generatingIdeas ? 'Gerando...' : '🧠 Gerar Ideias com IA'}
                  </Button>
                  <Button onClick={addQueueItem} disabled={!newTitle.trim()} className="gap-1 ml-auto">
                    <Plus className="w-3 h-3" /> Adicionar
                  </Button>
                </div>

                {/* Idea Generator Panel */}
                <AnimatePresence>
                  {showIdeaPanel && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="border border-primary/20 rounded-xl p-3 bg-primary/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-primary" />
                            Ideias para <span className="text-primary">{channels.find(c => c.id === newChannel)?.channel_name}</span>
                          </p>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowIdeaPanel(false)}>
                            Fechar
                          </Button>
                        </div>

                        {generatingIdeas ? (
                          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            Analisando nicho e gerando ideias...
                          </div>
                        ) : generatedIdeas.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma ideia gerada ainda.</p>
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto">
                            {generatedIdeas.map((idea, i) => (
                              <button key={i} onClick={() => selectIdea(idea)}
                                className="text-left bg-card border border-border rounded-lg p-2.5 hover:border-primary/50 hover:bg-primary/5 transition-all group">
                                <div className="flex items-start gap-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                    i < 3 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {i < 3 ? <Star className="w-3 h-3" /> : i + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium leading-tight group-hover:text-primary transition-colors">
                                      {idea.title || idea.tema}
                                    </p>
                                    {idea.hook && (
                                      <p className="text-[10px] text-muted-foreground mt-1 truncate">🎣 {idea.hook}</p>
                                    )}
                                    <div className="flex gap-1.5 mt-1.5">
                                      {idea.idea_score != null && (
                                        <Badge variant="secondary" className="text-[9px] px-1">
                                          ⚡ {typeof idea.idea_score === 'number' ? idea.idea_score.toFixed(0) : idea.idea_score}/100
                                        </Badge>
                                      )}
                                      {idea.viral_potential != null && (
                                        <Badge variant="outline" className="text-[9px] px-1">
                                          🔥 Viral {typeof idea.viral_potential === 'number' ? idea.viral_potential.toFixed(0) : idea.viral_potential}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
          {[
            { key: 'overview', label: 'Canais', icon: Youtube },
            { key: 'queue', label: 'Fila de Conteúdo', icon: Kanban },
            { key: 'groups', label: 'Grupos', icon: FolderOpen },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/30'
              }`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {channels.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Youtube className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground">Nenhum canal vinculado. Vá em "Meus Canais" para vincular.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {channels.map(ch => {
                  const chQueue = queue.filter(q => q.channel_id === ch.id);
                  const pending = chQueue.filter(q => q.status !== 'published').length;
                  return (
                    <div key={ch.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all">
                      <div className="flex items-start gap-3 mb-3">
                        {ch.thumbnail ? (
                          <img src={ch.thumbnail} alt={ch.channel_name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {ch.channel_name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{ch.channel_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {ch.subscribers?.toLocaleString()} subs • {ch.videos} vídeos
                          </p>
                          {ch.niche && <Badge variant="outline" className="text-[9px] mt-1">{ch.niche}</Badge>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-lg font-bold">{chQueue.length}</p>
                          <p className="text-[9px] text-muted-foreground">Na fila</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-lg font-bold text-amber-400">{pending}</p>
                          <p className="text-[9px] text-muted-foreground">Pendentes</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-lg font-bold text-emerald-400">{chQueue.filter(q => q.status === 'published').length}</p>
                          <p className="text-[9px] text-muted-foreground">Publicados</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="w-full mt-2 gap-1 text-xs"
                        onClick={() => { setFilterChannel(ch.id); setActiveTab('queue'); }}>
                        Ver fila <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar..." className="pl-9 bg-muted/30" />
              </div>
              <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
                className="h-9 rounded-md border border-input bg-muted/30 px-3 text-sm">
                <option value="all">Todos os canais</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.channel_name}</option>)}
              </select>
              {(filterStatus !== 'all' || filterChannel !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterStatus('all'); setFilterChannel('all'); }} className="text-xs">
                  Limpar filtros
                </Button>
              )}
            </div>

            {/* Queue Items */}
            {filtered.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Kanban className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground text-sm">Fila vazia. Adicione conteúdo acima.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map(item => (
                  <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className={`bg-card border rounded-xl p-3 hover:border-primary/20 transition-all ${PRIORITY_COLORS[item.priority] || 'border-border'}`}>
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          {item.scheduled_date && (
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              📅 {new Date(item.scheduled_date).toLocaleDateString('pt-BR')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>📺 {channelName(item.channel_id)}</span>
                          {item.niche && <span>• {item.niche}</span>}
                          <span>• {item.language?.toUpperCase()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select value={item.status}
                          onChange={e => updateQueueStatus(item.id, e.target.value)}
                          className={`h-7 rounded-md px-2 text-[10px] font-medium border-0 cursor-pointer ${STATUS_CONFIG[item.status]?.color || 'bg-muted'}`}>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => {
                            const otherChannels = channels.filter(c => c.id !== item.channel_id);
                            if (otherChannels.length === 0) { toast.info('Sem outros canais para rollout'); return; }
                            duplicateToChannels(item, otherChannels.map(c => c.id));
                          }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          onClick={() => deleteQueueItem(item.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="space-y-3">
            <Button onClick={() => setShowGroupForm(!showGroupForm)} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> Novo Grupo
            </Button>

            <AnimatePresence>
              {showGroupForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                      placeholder="Nome do grupo (ex: Canais Brasil)" className="bg-muted/30" />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Selecione canais:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {channels.map(ch => (
                          <button key={ch.id}
                            onClick={() => setNewGroupChannels(prev =>
                              prev.includes(ch.id) ? prev.filter(id => id !== ch.id) : [...prev, ch.id]
                            )}
                            className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                              newGroupChannels.includes(ch.id)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/30'
                            }`}>
                            {ch.channel_name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button onClick={createGroup} disabled={!newGroupName.trim()} size="sm" className="gap-1">
                      <Plus className="w-3 h-3" /> Criar Grupo
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {groups.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground text-sm">Crie grupos para gerenciar canais em lote.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {groups.map(g => (
                  <div key={g.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{g.name}</h3>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => deleteGroup(g.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.channels.map(chId => (
                        <Badge key={chId} variant="secondary" className="text-[10px]">
                          {channelName(chId)}
                        </Badge>
                      ))}
                      {g.channels.length === 0 && <p className="text-[10px] text-muted-foreground">Sem canais</p>}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <Badge variant="outline" className="text-[9px]">🌍 {g.default_country}</Badge>
                      <Badge variant="outline" className="text-[9px]">🗣 {g.default_language}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MultiChannel;
