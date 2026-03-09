import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Search, Users, Eye, TrendingUp, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ChannelResult {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
}

const YOUTUBE_API_KEY = 'AIzaSyBxMtFibQNPqNP3q_SussnxFmPmwXbhkRw';

const ChannelSearch = () => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChannelResult[]>([]);
  const [loading, setLoading] = useState(false);

  const searchChannels = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=12&key=${YOUTUBE_API_KEY}`
      );
      const searchData = await searchRes.json();
      if (searchData.error) throw new Error(searchData.error.message);

      const channelIds = searchData.items?.map((item: any) => item.snippet.channelId).join(',');
      if (!channelIds) { setResults([]); setLoading(false); return; }

      const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelIds}&key=${YOUTUBE_API_KEY}`
      );
      const statsData = await statsRes.json();

      const channels: ChannelResult[] = statsData.items?.map((ch: any) => ({
        id: ch.id,
        title: ch.snippet.title,
        description: ch.snippet.description?.slice(0, 100) || '',
        thumbnail: ch.snippet.thumbnails?.medium?.url || '',
        subscriberCount: ch.statistics.subscriberCount || '0',
        viewCount: ch.statistics.viewCount || '0',
        videoCount: ch.statistics.videoCount || '0',
      })) || [];

      setResults(channels);
    } catch (err: any) {
      toast.error(err.message || 'Erro na busca');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (n: string) => {
    const num = parseInt(n);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return n;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">{t('search.title')}</h1>
          <p className="text-muted-foreground mt-1">Encontre canais, nichos e outliers</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchChannels()}
              className="pl-10 bg-secondary/50"
            />
          </div>
          <Button onClick={searchChannels} disabled={loading} className="gradient-hero border-0">
            {loading ? t('common.loading') : t('common.search')}
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((ch) => (
            <div key={ch.id} className="glass rounded-xl p-5 hover:border-primary/30 transition-all">
              <div className="flex items-start gap-3 mb-4">
                <img src={ch.thumbnail} alt={ch.title} className="w-12 h-12 rounded-full" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{ch.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{ch.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="glass rounded-lg p-2">
                  <Users className="w-3 h-3 mx-auto mb-1 text-primary" />
                  <p className="text-xs font-medium">{formatNumber(ch.subscriberCount)}</p>
                  <p className="text-[10px] text-muted-foreground">Subs</p>
                </div>
                <div className="glass rounded-lg p-2">
                  <Eye className="w-3 h-3 mx-auto mb-1 text-accent" />
                  <p className="text-xs font-medium">{formatNumber(ch.viewCount)}</p>
                  <p className="text-[10px] text-muted-foreground">Views</p>
                </div>
                <div className="glass rounded-lg p-2">
                  <TrendingUp className="w-3 h-3 mx-auto mb-1 text-emerald-500" />
                  <p className="text-xs font-medium">{ch.videoCount}</p>
                  <p className="text-[10px] text-muted-foreground">Videos</p>
                </div>
              </div>
              <a
                href={`https://youtube.com/channel/${ch.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 mt-3 text-xs text-primary hover:underline"
              >
                Ver no YouTube <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>

        {results.length === 0 && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Pesquise por um nicho ou canal para começar</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ChannelSearch;
