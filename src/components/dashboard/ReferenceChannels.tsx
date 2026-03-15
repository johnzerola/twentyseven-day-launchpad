import { useState, useEffect } from 'react';
import { ExternalLink, DollarSign, Eye, Users, TrendingUp, Loader2, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatNumber } from '@/lib/formatters';

interface RefChannel {
  id: string;
  channel_name: string;
  youtube_handle: string;
  subscribers: number;
  avg_views: number;
  estimated_revenue_min: number;
  estimated_revenue_max: number;
  niche: string;
  is_faceless: boolean;
  top_videos: { title: string; views: number }[];
  visual_style: string;
  content_format: string;
}

const NICHE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pets', label: '🐱 Pets' },
  { key: 'travel', label: '✈️ Travel' },
  { key: 'philosophy', label: '📖 Philosophy' },
  { key: 'health', label: '💪 Health' },
  { key: 'curiosidades', label: '🧠 Curiosidades' },
  { key: 'história', label: '📜 História' },
  { key: 'terror', label: '👻 Terror' },
  { key: 'finanças', label: '💰 Finanças' },
  { key: 'gaming', label: '🎮 Gaming' },
  { key: 'psychology', label: '🧠 Psicologia' },
];

const FORMAT_LABELS: Record<string, string> = {
  listicle: '📋 Listicle',
  documentary: '📹 Documentary',
  facts: '⚡ Facts',
  reddit: '🗣️ Reddit Stories',
  storytelling: '📖 Storytelling',
  split_screen: '📱 Split Screen',
  gameplay: '🎮 Gameplay',
};

export const ReferenceChannels = () => {
  const [channels, setChannels] = useState<RefChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('reference_channels').select('*').order('subscribers', { ascending: false });
      setChannels((data as any[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = filter === 'all' ? channels : channels.filter(c => c.niche === filter);

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">🏆 Canais Faceless de Referência</h3>
          <p className="text-xs text-muted-foreground">Canais monetizados reais que você pode replicar com nosso sistema</p>
        </div>
        <Badge className="bg-primary/20 text-primary">{channels.length} canais</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {NICHE_FILTERS.filter(n => n.key === 'all' || channels.some(c => c.niche === n.key)).map(n => (
          <Button key={n.key} size="sm" variant={filter === n.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFilter(n.key)}>
            {n.label}
          </Button>
        ))}
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(ch => (
          <div key={ch.id} className="border border-border/50 rounded-xl p-4 bg-card hover:border-primary/30 transition-colors space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-foreground text-sm">{ch.channel_name}</h4>
                <p className="text-[10px] text-muted-foreground">{ch.youtube_handle}</p>
              </div>
              {ch.youtube_handle && (
                <a href={`https://youtube.com/${ch.youtube_handle}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/30 rounded-lg p-2">
                <Users className="w-3 h-3 mx-auto text-primary mb-0.5" />
                <p className="text-xs font-bold text-foreground">{formatNumber(ch.subscribers)}</p>
                <p className="text-[9px] text-muted-foreground">Subs</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <Eye className="w-3 h-3 mx-auto text-accent mb-0.5" />
                <p className="text-xs font-bold text-foreground">{formatNumber(ch.avg_views)}</p>
                <p className="text-[9px] text-muted-foreground">Avg Views</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <DollarSign className="w-3 h-3 mx-auto text-green-500 mb-0.5" />
                <p className="text-xs font-bold text-green-500">${ch.estimated_revenue_min}-${formatNumber(ch.estimated_revenue_max)}</p>
                <p className="text-[9px] text-muted-foreground">/mês</p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[9px]">{ch.niche}</Badge>
              {ch.content_format && <Badge className="bg-primary/10 text-primary text-[9px]">{FORMAT_LABELS[ch.content_format] || ch.content_format}</Badge>}
              {ch.is_faceless && <Badge className="bg-accent/10 text-accent text-[9px]">👤 Faceless</Badge>}
            </div>

            {/* Top Videos */}
            {ch.top_videos?.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium">Top Vídeos:</p>
                {ch.top_videos.slice(0, 3).map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] bg-muted/20 rounded px-2 py-1">
                    <span className="truncate flex-1 text-foreground">{v.title}</span>
                    <span className="text-primary font-medium ml-2 shrink-0">{formatNumber(v.views)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Nenhum canal neste nicho ainda.</p>
      )}
    </div>
  );
};
