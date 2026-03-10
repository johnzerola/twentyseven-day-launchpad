import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Youtube, Plus, Trash2, BarChart3, Users, Eye, Video, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatters';

interface Channel {
  id: string;
  youtube_channel_id: string;
  channel_name: string;
  thumbnail: string | null;
  subscribers: number;
  views: number;
  videos: number;
  niche: string | null;
  analysis_json: any;
  linked_at: string;
}

// API key moved to edge function

const Channels = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingChannel, setAddingChannel] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from('user_channels').select('*').eq('user_id', user.id).order('linked_at', { ascending: false }) as any;
    setChannels(data || []);
    setLoading(false);
  };

  const addChannel = async () => {
    if (!channelInput.trim()) return;
    setAddingChannel(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Faça login primeiro');

      // Resolve channel via edge function (no API key in frontend)
      const { data: chData, error: chError } = await supabase.functions.invoke('resolve-channel', {
        body: { channelInput: channelInput.trim() },
      });
      if (chError) throw new Error(chError.message);
      if (chData?.error) throw new Error(chData.error);

      await supabase.from('user_channels').insert({
        user_id: user.id,
        youtube_channel_id: chData.channelId,
        channel_name: chData.name,
        thumbnail: chData.thumbnail,
        subscribers: chData.subscribers,
        views: chData.views,
        videos: chData.videos,
      } as any);

      toast.success('Canal adicionado!');
      setChannelInput('');
      setShowAdd(false);
      loadChannels();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar canal');
    } finally {
      setAddingChannel(false);
    }
  };

  const removeChannel = async (id: string) => {
    await supabase.from('user_channels').delete().eq('id', id);
    toast.success('Canal removido');
    loadChannels();
  };

  const refreshChannel = async (channel: Channel) => {
    try {
      const { data: chData, error } = await supabase.functions.invoke('resolve-channel', {
        body: { channelInput: channel.youtube_channel_id },
      });
      if (error || chData?.error) throw new Error(chData?.error || 'Erro');
      await supabase.from('user_channels').update({
        subscribers: chData.subscribers,
        views: chData.views,
        videos: chData.videos,
      } as any).eq('id', channel.id);
      toast.success('Dados atualizados!');
      loadChannels();
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectedChannels = channels.filter(c => selectedIds.includes(c.id));
  const totalSubs = selectedChannels.reduce((s, c) => s + c.subscribers, 0);
  const totalViews = selectedChannels.reduce((s, c) => s + c.views, 0);
  const totalVideos = selectedChannels.reduce((s, c) => s + c.videos, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <Youtube className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Meus Canais</h1>
              <p className="text-sm text-muted-foreground">Gerencie e compare seus canais</p>
            </div>
          </div>
          <div className="flex gap-2">
            {channels.length > 1 && (
              <Button variant="outline" onClick={() => { setCompareMode(!compareMode); setSelectedIds([]); }} className="gap-2">
                <BarChart3 className="w-4 h-4" /> {compareMode ? 'Sair' : 'Comparar'}
              </Button>
            )}
            <Button onClick={() => setShowAdd(!showAdd)} className="gradient-hero border-0 gap-2">
              <Plus className="w-4 h-4" /> Adicionar Canal
            </Button>
          </div>
        </div>

        {/* Add channel form */}
        {showAdd && (
          <div className="glass rounded-xl p-5 flex gap-3">
            <Input
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addChannel()}
              placeholder="Cole a URL do canal ou @username"
              className="bg-secondary/50"
            />
            <Button onClick={addChannel} disabled={addingChannel} className="gradient-hero border-0">
              {addingChannel ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        )}

        {/* Compare bar */}
        {compareMode && selectedChannels.length > 0 && (
          <div className="glass rounded-xl p-5">
            <h3 className="font-semibold mb-3">Comparação ({selectedChannels.length} canais)</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{formatNumber(totalSubs)}</p>
                <p className="text-xs text-muted-foreground">Inscritos total</p>
              </div>
              <div className="text-center">
                <Eye className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-lg font-bold">{formatNumber(totalViews)}</p>
                <p className="text-xs text-muted-foreground">Views total</p>
              </div>
              <div className="text-center">
                <Video className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                <p className="text-lg font-bold">{totalVideos}</p>
                <p className="text-xs text-muted-foreground">Vídeos total</p>
              </div>
            </div>
            <div className="space-y-2">
              {selectedChannels.map(ch => (
                <div key={ch.id} className="flex items-center justify-between text-sm bg-secondary/30 rounded-lg p-3">
                  <span className="font-medium">{ch.channel_name}</span>
                  <div className="flex gap-4 text-muted-foreground">
                    <span>{formatNumber(ch.subscribers)} subs</span>
                    <span>{formatNumber(ch.views)} views</span>
                    <span>{ch.videos} vídeos</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channel cards */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : channels.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Youtube className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h3 className="text-lg font-semibold mb-2">Nenhum canal adicionado</h3>
            <p className="text-muted-foreground mb-6">Adicione seu primeiro canal ou faça o onboarding.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setShowAdd(true)} className="gradient-hero border-0">Adicionar Canal</Button>
              <Link to="/onboarding"><Button variant="outline">Fazer Onboarding</Button></Link>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map(ch => (
              <div
                key={ch.id}
                className={`glass rounded-xl p-5 transition-all ${compareMode ? 'cursor-pointer' : ''} ${selectedIds.includes(ch.id) ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/20'}`}
                onClick={() => compareMode && toggleSelect(ch.id)}
              >
                <div className="flex items-start gap-3 mb-4">
                  {ch.thumbnail && <img src={ch.thumbnail} alt={ch.channel_name} className="w-12 h-12 rounded-full" />}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{ch.channel_name}</h3>
                    {ch.niche && <p className="text-xs text-primary">{ch.niche}</p>}
                  </div>
                  {!compareMode && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => refreshChannel(ch)}>
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeChannel(ch.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="glass rounded-lg p-2">
                    <Users className="w-3 h-3 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-medium">{formatNumber(ch.subscribers)}</p>
                    <p className="text-[10px] text-muted-foreground">Subs</p>
                  </div>
                  <div className="glass rounded-lg p-2">
                    <Eye className="w-3 h-3 mx-auto mb-1 text-accent" />
                    <p className="text-xs font-medium">{formatNumber(ch.views)}</p>
                    <p className="text-[10px] text-muted-foreground">Views</p>
                  </div>
                  <div className="glass rounded-lg p-2">
                    <Video className="w-3 h-3 mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs font-medium">{ch.videos}</p>
                    <p className="text-[10px] text-muted-foreground">Vídeos</p>
                  </div>
                </div>
                <a
                  href={`https://youtube.com/channel/${ch.youtube_channel_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 mt-3 text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Ver no YouTube <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Channels;
