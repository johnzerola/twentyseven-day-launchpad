import { useState, useEffect, useMemo } from 'react';
import { Briefcase, Copy, Download, Users, Eye, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatters';

const NICHE_BRANDS: Record<string, string[]> = {
  'finanças': ['Nubank', 'C6 Bank', 'Rico Investimentos', 'Magnetis', 'Hotmart — cursos finanças'],
  'tecnologia': ['Amazon Brasil', 'Mercado Livre', 'HostGator', 'Canva', 'Hotmart — cursos IA'],
  'saúde': ['iHerb', 'Amazon suplementos', 'Hotmart — wellness', 'Growth Supplements', 'Shopee saúde'],
  'terror': ['Amazon Prime afiliados', 'Editoras independentes', 'Audible', 'Hotmart — escrita criativa'],
  'gaming': ['Nuuvem', 'Amazon Gaming', 'HyperX', 'Razer Brasil', 'Green Man Gaming'],
  'educação': ['Udemy', 'Hotmart', 'Amazon Livros', 'Audible', 'Descomplica'],
};

interface Props {
  niche?: string;
}

export function MediaKitGenerator({ niche }: Props) {
  const [channelName, setChannelName] = useState('');
  const [subscribers, setSubscribers] = useState(0);
  const [avgViews, setAvgViews] = useState(0);
  const [engagement, setEngagement] = useState(0);
  const [bestVideo, setBestVideo] = useState('');
  const [detectedNiche, setDetectedNiche] = useState(niche || 'educação');

  useEffect(() => {
    loadChannelData();
  }, []);

  const loadChannelData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: channel } = await supabase
      .from('user_channels')
      .select('channel_name, subscribers, views, videos, niche')
      .eq('user_id', user.id)
      .order('linked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (channel) {
      setChannelName(channel.channel_name || '');
      setSubscribers(channel.subscribers || 0);
      const vids = channel.videos || 1;
      setAvgViews(Math.round((channel.views || 0) / vids));
      setEngagement(4.2); // fallback
      if (channel.niche) setDetectedNiche(channel.niche);
    }
  };

  const pricing = useMemo(() => ({
    mention15s: Math.max(20, Math.round(20 * avgViews / 1000)),
    integration60s: Math.max(40, Math.round(40 * avgViews / 1000)),
    dedicated: Math.max(80, Math.round(80 * avgViews / 1000)),
  }), [avgViews]);

  const brands = NICHE_BRANDS[detectedNiche] || NICHE_BRANDS['educação'];

  const generateMediaKit = () => {
    const kit = `═══ MEDIA KIT — ${channelName || 'Meu Canal'} ═══

📊 DADOS DO CANAL
• Canal: ${channelName}
• Nicho: ${detectedNiche}
• Inscritos: ${formatNumber(subscribers)}
• Média de views/vídeo: ${formatNumber(avgViews)}
• Engajamento: ${engagement}% (superior à média do YouTube de 3-5%)

🎯 PROPOSTA
Meu canal ${channelName} produz conteúdo sobre ${detectedNiche} para uma audiência engajada e qualificada. Com média de ${formatNumber(avgViews)} views por vídeo e ${engagement}% de engajamento, ofereço menções autênticas integradas ao conteúdo.

💰 TABELA DE PREÇOS
• Menção 15s: R$${pricing.mention15s}
• Integração 60s: R$${pricing.integration60s}
• Vídeo dedicado: R$${pricing.dedicated}

📩 Contato: [SEU EMAIL]`;

    navigator.clipboard.writeText(kit);
    toast.success('Media Kit copiado!');
  };

  const generateOutreach = (brand: string) => {
    const msg = `Olá equipe ${brand}!

Sou criador de conteúdo sobre ${detectedNiche} no YouTube com ${formatNumber(subscribers)} inscritos e média de ${formatNumber(avgViews)} views por vídeo.

Meu público é altamente engajado (${engagement}% de engajamento, acima da média do YouTube) e se encaixa perfeitamente no perfil de clientes da ${brand}.

Gostaria de propor uma parceria de menção integrada ao meu conteúdo. Posso apresentar a ${brand} de forma natural dentro dos meus vídeos, o que historicamente gera melhores resultados que anúncios tradicionais.

Posso enviar meu Media Kit completo com dados detalhados do canal.

Obrigado pela atenção!`;

    navigator.clipboard.writeText(msg);
    toast.success(`Mensagem para ${brand} copiada!`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" /> Media Kit & Micro Sponsorship
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Gere seu Media Kit profissional e entre em contato com marcas do seu nicho
        </p>
      </div>

      {/* Channel stats (editable) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Canal</label>
          <Input value={channelName} onChange={e => setChannelName(e.target.value)} className="h-8 text-xs" placeholder="Nome" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Inscritos</label>
          <Input type="number" value={subscribers} onChange={e => setSubscribers(Number(e.target.value))} className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Views/vídeo</label>
          <Input type="number" value={avgViews} onChange={e => setAvgViews(Number(e.target.value))} className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Engajamento %</label>
          <Input type="number" step="0.1" value={engagement} onChange={e => setEngagement(Number(e.target.value))} className="h-8 text-xs" />
        </div>
      </div>

      {/* Pricing preview */}
      <div className="bg-chart-2/10 border border-chart-2/20 rounded-xl p-4">
        <p className="text-xs font-semibold mb-2 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-chart-2" /> Preços sugeridos</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-background rounded-lg p-2">
            <p className="text-sm font-bold text-chart-2">R${pricing.mention15s}</p>
            <p className="text-[9px] text-muted-foreground">Menção 15s</p>
          </div>
          <div className="bg-background rounded-lg p-2">
            <p className="text-sm font-bold text-chart-2">R${pricing.integration60s}</p>
            <p className="text-[9px] text-muted-foreground">Integração 60s</p>
          </div>
          <div className="bg-background rounded-lg p-2">
            <p className="text-sm font-bold text-chart-2">R${pricing.dedicated}</p>
            <p className="text-[9px] text-muted-foreground">Vídeo dedicado</p>
          </div>
        </div>
      </div>

      <Button onClick={generateMediaKit} className="w-full gap-2 text-xs">
        <Copy className="w-3.5 h-3.5" /> Copiar Media Kit Completo
      </Button>

      {/* Brand targets */}
      <div>
        <p className="text-xs font-semibold mb-2">🎯 Marcas para contatar ({detectedNiche})</p>
        <div className="space-y-2">
          {brands.map((brand, i) => (
            <div key={i} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
              <span className="text-xs font-medium">{brand}</span>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1" onClick={() => generateOutreach(brand)}>
                <Copy className="w-3 h-3" /> Copiar mensagem
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
