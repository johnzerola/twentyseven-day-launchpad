import { useState, useEffect } from 'react';
import { Youtube, Link2, Unlink, Loader2, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from 'sonner';

interface ConnectedChannel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_thumbnail: string;
  connected_at: string;
  scopes?: string[] | null;
  has_upload_scope?: boolean;
}

const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

export const YouTubeOAuthConnect = () => {
  const [connectedChannels, setConnectedChannels] = useState<ConnectedChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchConnectedChannels();
  }, []);

  const fetchConnectedChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('youtube_oauth_tokens_safe' as any)
        .select('id, channel_id, channel_name, channel_thumbnail, connected_at, scopes');
      if (error) throw error;
      const rows = (data as unknown as ConnectedChannel[]) || [];
      setConnectedChannels(
        rows.map((r) => ({
          ...r,
          has_upload_scope: Array.isArray(r.scopes) && r.scopes.includes(UPLOAD_SCOPE),
        })),
      );
    } catch (err) {
      console.error('Error fetching connected channels:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Você precisa estar logado');

      const resp = await authFetch('youtube-oauth-start', { userId: user.id });
      const { authUrl, error } = await resp.json();
      if (error) throw new Error(error);

      // Open OAuth consent screen in popup
      const popup = window.open(authUrl, 'youtube-oauth', 'width=600,height=700');

      // Poll for popup close, then refresh
      const interval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(interval);
          await fetchConnectedChannels();
          // Reload the page to refresh user_channels list
          window.location.reload();
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        setLoading(false);
      }, 300000);
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  };

  const handleDisconnect = async (id: string, channelName: string) => {
    try {
      const { error } = await supabase
        .from('youtube_oauth_tokens')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success(`Canal "${channelName}" desconectado do OAuth`);
      setConnectedChannels(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (fetching) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Youtube className="w-5 h-5 text-destructive" />
          <CardTitle className="text-base">YouTube Analytics (OAuth)</CardTitle>
          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
            Dados Avançados
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Canais conectados via OAuth têm acesso a dados privados (CTR, retenção, receita) além de todas as funcionalidades padrão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connectedChannels.map((ch) => (
          <div key={ch.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
            {ch.channel_thumbnail && (
              <img src={ch.channel_thumbnail} alt="" className="w-8 h-8 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{ch.channel_name}</p>
              <p className="text-[10px] text-muted-foreground">{ch.channel_id}</p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Badge variant="outline" className="text-[10px] gap-1 text-emerald-400 border-emerald-400/30">
                <BarChart3 className="w-3 h-3" /> OAuth
              </Badge>
              {ch.has_upload_scope ? (
                <Badge variant="outline" className="text-[10px] gap-1 text-emerald-400 border-emerald-400/30">
                  ⬆ Upload OK
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1 text-amber-400 border-amber-400/30">
                  ⚠ Reconectar p/ upload
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleDisconnect(ch.id, ch.channel_name || '')}
            >
              <Unlink className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}

        <Button
          onClick={handleConnect}
          disabled={loading}
          variant="outline"
          className="w-full gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Link2 className="w-4 h-4" />
          )}
          {connectedChannels.length > 0 ? 'Conectar outro canal' : 'Conectar Canal YouTube'}
        </Button>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          🔒 Canais conectados via OAuth aparecem automaticamente em "Meus Canais" com todas as funcionalidades + métricas avançadas exclusivas.
        </p>
      </CardContent>
    </Card>
  );
};
