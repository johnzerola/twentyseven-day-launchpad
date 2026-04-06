import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, Loader2, Star, Eye, Zap, BookOpen, Target, TrendingUp, Clock } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';
import { motion, AnimatePresence } from 'framer-motion';

interface ReferenceChannel {
  id: string;
  youtube_channel_id: string;
  channel_name: string;
  thumbnail: string | null;
  role: string;
  latest_intel: any;
  last_scanned_at: string | null;
  created_at: string;
}

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  model: { label: 'Modelo Geral', icon: Star, color: 'text-amber-400', desc: 'Modelar tudo: estilo, hooks, formato' },
  style: { label: 'Estilo Visual', icon: Eye, color: 'text-purple-400', desc: 'Copiar estilo de narração e visual' },
  hook: { label: 'Hooks', icon: Zap, color: 'text-red-400', desc: 'Modelar ganchos e aberturas' },
  format: { label: 'Formato', icon: BookOpen, color: 'text-blue-400', desc: 'Copiar estrutura e formato' },
};

const MAX_REFS = 5;

export const ReferenceChannelsTab = () => {
  const [refs, setRefs] = useState<ReferenceChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [selectedRole, setSelectedRole] = useState('model');

  useEffect(() => { loadRefs(); }, []);

  const loadRefs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_reference_channels' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setRefs((data as any[]) || []);
    setLoading(false);
  };

  const addRef = async () => {
    if (!channelInput.trim()) return;
    if (refs.length >= MAX_REFS) { toast.error(`Máximo de ${MAX_REFS} canais de referência`); return; }
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Faça login');

      toast.info('Buscando canal...');
      const { data: chData, error } = await supabase.functions.invoke('resolve-channel', {
        body: { channelInput: channelInput.trim() },
      });
      if (error || chData?.error) throw new Error(chData?.error || error?.message);

      // Check if already exists
      const existing = refs.find(r => r.youtube_channel_id === chData.channelId);
      if (existing) { toast.error('Canal já está nas referências'); setAdding(false); return; }

      // Try to find in channel_intelligence
      const { data: intel } = await supabase
        .from('channel_intelligence')
        .select('id')
        .eq('youtube_channel_id', chData.channelId)
        .maybeSingle();

      await supabase.from('user_reference_channels' as any).insert({
        user_id: user.id,
        youtube_channel_id: chData.channelId,
        channel_name: chData.name,
        thumbnail: chData.thumbnail,
        role: selectedRole,
        channel_intelligence_id: intel?.id || null,
      });

      toast.success(`${chData.name} adicionado como referência!`);
      setChannelInput('');
      setShowAdd(false);
      await loadRefs();

      // Trigger scan
      toast.info('Escaneando vídeos recentes...');
      await supabase.functions.invoke('refresh-references', { body: { force: true } });
      await loadRefs();
      toast.success('Intel extraída!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar');
    }
    setAdding(false);
  };

  const removeRef = async (id: string) => {
    await supabase.from('user_reference_channels' as any).delete().eq('id', id);
    toast.success('Referência removida');
    loadRefs();
  };

  const refreshRef = async (id: string) => {
    setRefreshing(id);
    try {
      await supabase.functions.invoke('refresh-references', { body: { channelId: id, force: true } });
      await loadRefs();
      toast.success('Intel atualizada!');
    } catch { toast.error('Erro ao atualizar'); }
    setRefreshing(null);
  };

  const refreshAll = async () => {
    setRefreshing('all');
    try {
      const { data } = await supabase.functions.invoke('refresh-references', { body: { force: true } });
      await loadRefs();
      toast.success(`${data?.refreshed || 0} canais atualizados!`);
    } catch { toast.error('Erro ao atualizar'); }
    setRefreshing(null);
  };

  const updateRole = async (id: string, newRole: string) => {
    await supabase.from('user_reference_channels' as any).update({ role: newRole }).eq('id', id);
    setRefs(prev => prev.map(r => r.id === id ? { ...r, role: newRole } : r));
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Canais de Referência</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{refs.length}/{MAX_REFS} · A IA modela seus vídeos baseada nesses canais</p>
        </div>
        <div className="flex gap-2">
          {refs.length > 0 && (
            <Button size="sm" variant="outline" onClick={refreshAll} disabled={refreshing === 'all'}>
              {refreshing === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1">Atualizar Todos</span>
            </Button>
          )}
          {refs.length < MAX_REFS && (
            <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gradient-hero border-0 gap-1">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          )}
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex gap-3">
                <Input value={channelInput} onChange={e => setChannelInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRef()} placeholder="URL do canal, @username ou nome" className="bg-secondary/50 flex-1" />
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addRef} disabled={adding} className="gradient-hero border-0">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                💡 Escolha o papel: <strong>Modelo</strong> = copiar tudo · <strong>Hooks</strong> = só ganchos · <strong>Estilo</strong> = narração/visual · <strong>Formato</strong> = estrutura
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {refs.length === 0 && !showAdd && (
        <div className="glass rounded-2xl p-10 text-center">
          <Target className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
          <h3 className="text-lg font-semibold mb-1">Nenhum canal de referência</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Adicione canais que você admira. A IA vai analisar os vídeos deles e usar como modelo para suas sugestões, roteiros e títulos.
          </p>
          <Button onClick={() => setShowAdd(true)} className="gradient-hero border-0 gap-2"><Plus className="w-4 h-4" /> Adicionar Referência</Button>
        </div>
      )}

      {/* Reference cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {refs.map((ref) => {
            const roleCfg = ROLE_CONFIG[ref.role] || ROLE_CONFIG.model;
            const intel = ref.latest_intel || {};
            const hasIntel = intel.title_patterns?.length > 0;

            return (
              <motion.div key={ref.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="glass rounded-xl p-4 space-y-3">
                {/* Card header */}
                <div className="flex items-center gap-3">
                  {ref.thumbnail && <img src={ref.thumbnail} alt="" className="w-10 h-10 rounded-full ring-2 ring-primary/20" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{ref.channel_name}</p>
                      <Badge variant="outline" className={`text-[10px] ${roleCfg.color} border-current/30`}>
                        <roleCfg.icon className="w-3 h-3 mr-1" />{roleCfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      {ref.last_scanned_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Scan: {new Date(ref.last_scanned_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {intel.posting_frequency && <span>📅 {intel.posting_frequency}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Select value={ref.role} onValueChange={v => updateRole(ref.id, v)}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => refreshRef(ref.id)} disabled={refreshing === ref.id}>
                      {refreshing === ref.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeRef(ref.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Intel display */}
                {hasIntel && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Title patterns */}
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Padrões de Título</p>
                      <div className="space-y-1">
                        {(intel.title_patterns || []).slice(0, 4).map((p: string, i: number) => (
                          <p key={i} className="text-xs">• {p}</p>
                        ))}
                      </div>
                    </div>

                    {/* Hook types */}
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" /> Tipos de Hook</p>
                      <div className="space-y-1">
                        {(intel.hook_types || []).slice(0, 4).map((h: string, i: number) => (
                          <p key={i} className="text-xs">• {h}</p>
                        ))}
                      </div>
                    </div>

                    {/* Top performing */}
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Star className="w-3 h-3" /> Elementos Top</p>
                      <div className="space-y-1">
                        {(intel.top_performing_elements || []).slice(0, 3).map((e: string, i: number) => (
                          <p key={i} className="text-xs">• {e}</p>
                        ))}
                      </div>
                    </div>

                    {/* Recent videos */}
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Eye className="w-3 h-3" /> Vídeos Recentes</p>
                      <div className="space-y-1">
                        {(intel.recent_videos || []).slice(0, 3).map((v: any, i: number) => (
                          <p key={i} className="text-xs truncate">• {v.title} <span className="text-muted-foreground">({formatNumber(v.views)})</span></p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Format shift alert */}
                {intel.format_shift && intel.format_shift !== 'none' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span><strong>Mudança detectada:</strong> {intel.format_shift}</span>
                  </div>
                )}

                {/* No intel yet */}
                {!hasIntel && (
                  <div className="bg-secondary/20 rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground">Intel ainda não extraída</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => refreshRef(ref.id)}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Escanear Agora
                    </Button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
