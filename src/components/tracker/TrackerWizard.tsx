import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Rocket, Youtube, Video, Zap, Play, Users, Eye, Loader2,
  ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle, Film
} from 'lucide-react';

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
}

interface WizardData {
  channelId: string;
  channel: Channel | null;
  format: 'shorts' | 'long' | 'both';
  customNiche: string;
  strategy: string;
}

interface TrackerWizardProps {
  onPlanGenerated: () => void;
}

const FORMAT_OPTIONS = [
  {
    value: 'shorts' as const,
    icon: Zap,
    label: 'Shorts Only',
    desc: '⚠️ Shorts pagam R$0.05-0.50/1K views. Para monetizar em 30 dias, inclua pelo menos 2 longforms/semana.',
    ypp: '10M views (Shorts)',
    best: 'Crescimento rápido, faceless, compilações',
    warning: '📊 Dados reais: Shorts RPM = R$0.05-0.50/1K views vs Longform RPM = R$2-25/1K views.',
  },
  {
    value: 'long' as const,
    icon: Film,
    label: 'Longform Only',
    desc: 'Meta: 1.000 subs + 4.000h watch time. Vídeos de 8-20 min.',
    ypp: '1K subs + 4Kh watch',
    best: 'RPM alto, autoridade, SEO evergreen',
  },
  {
    value: 'both' as const,
    icon: Play,
    label: 'Shorts + Longform',
    desc: 'Estratégia híbrida. Shorts para inscritos, longform para watch time.',
    ypp: 'Ambos os caminhos',
    best: 'Máxima cobertura, canais com equipe',
  },
];

export function TrackerWizard({ onPlanGenerated }: TrackerWizardProps) {
  const [step, setStep] = useState(0);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [channelAnalysis, setChannelAnalysis] = useState<any>(null);
  const [analyzingChannel, setAnalyzingChannel] = useState(false);

  const [wizard, setWizard] = useState<WizardData>({
    channelId: '',
    channel: null,
    format: 'shorts',
    customNiche: '',
    strategy: 'shorts-first',
  });

  // Load user channels
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_channels' as any)
        .select('*')
        .eq('user_id', user.id);
      setChannels((data as any) || []);
      setLoadingChannels(false);
    })();
  }, []);

  const selectChannel = async (ch: Channel) => {
    setWizard(prev => ({ ...prev, channelId: ch.id, channel: ch, customNiche: ch.niche || '' }));
    
    // Analyze channel from system databases
    setAnalyzingChannel(true);
    try {
      const [intelligenceRes, dnaRes, nicheRes] = await Promise.all([
        supabase.from('channel_intelligence' as any)
          .select('*')
          .eq('youtube_channel_id', ch.youtube_channel_id)
          .limit(1),
        supabase.from('content_dna' as any)
          .select('viral_score, hook_type, content_model, views, video_type')
          .eq('channel_id', ch.youtube_channel_id)
          .order('views', { ascending: false })
          .limit(10),
        supabase.from('niche_database' as any)
          .select('*')
          .ilike('name', `%${ch.niche || ''}%`)
          .limit(3),
      ]);

      setChannelAnalysis({
        intelligence: (intelligenceRes.data as any)?.[0] || null,
        topDNA: (dnaRes.data as any) || [],
        nicheData: (nicheRes.data as any) || [],
        channelStats: {
          subscribers: ch.subscribers,
          views: ch.views,
          videos: ch.videos,
          niche: ch.niche,
          isNew: ch.videos <= 5,
        },
      });
    } catch (e) {
      console.error('Channel analysis error:', e);
    }
    setAnalyzingChannel(false);
  };

  const generatePlan = async () => {
    if (!wizard.channel) return;
    setGenerating(true);
    try {
      const strategyMap = {
        shorts: 'shorts-first',
        long: 'longform-first',
        both: 'hybrid',
      };

      const { data, error } = await supabase.functions.invoke('generate-adaptive-plan', {
        body: {
          niche: wizard.customNiche || wizard.channel.niche || 'curiosidades',
          language: 'pt',
          country: 'BR',
          channelId: wizard.channel.id,
          strategy: strategyMap[wizard.format],
          channelAnalysis: channelAnalysis,
          format: wizard.format,
          channelStats: {
            subscribers: wizard.channel.subscribers,
            views: wizard.channel.views,
            videos: wizard.channel.videos,
            youtube_channel_id: wizard.channel.youtube_channel_id,
          },
        },
      });
      if (error) throw error;

      // Feed back into knowledge - save plan context to ai_learning
      try {
        await supabase.from('ai_learning' as any).insert({
          topic: 'tracker-plan-generated',
          source: `channel:${wizard.channel.youtube_channel_id}`,
          insight: JSON.stringify({
            niche: wizard.customNiche || wizard.channel.niche,
            format: wizard.format,
            strategy: strategyMap[wizard.format],
            channelVideos: wizard.channel.videos,
            channelSubs: wizard.channel.subscribers,
          }),
        } as any);
      } catch {} // non-critical

      toast.success('Plano de 30 dias gerado com sucesso! 🚀');
      onPlanGenerated();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar plano');
    } finally {
      setGenerating(false);
    }
  };

  // No channels registered
  if (!loadingChannels && channels.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk'] mb-2">
            Canal Necessário
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Para usar o Tracker 30 Dias, você precisa ter pelo menos um canal registrado.
            Isso garante que o plano seja personalizado com dados reais do seu canal.
          </p>
          <Button onClick={() => window.location.href = '/channels'} size="lg">
            <Youtube className="w-4 h-4 mr-2" />
            Registrar Meu Canal
          </Button>
        </div>
      </div>
    );
  }

  if (loadingChannels) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Rocket className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-['Space_Grotesk'] mb-2">
          Monetize em 30 Dias
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Plano personalizado baseado no SEU canal, com IA que analisa seus dados reais.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {['Canal', 'Formato', 'Confirmar'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              i < step ? 'bg-primary text-primary-foreground' :
              i === step ? 'bg-primary/20 text-primary ring-2 ring-primary/30' :
              'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground/30" />}
          </div>
        ))}
      </div>

      {/* Step 0: Select Channel */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-center mb-4">Selecione o canal para monetizar</h2>
          <div className="grid gap-3">
            {channels.map(ch => (
              <Card
                key={ch.id}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  wizard.channelId === ch.id ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
                onClick={() => selectChannel(ch)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {ch.thumbnail ? (
                    <img src={ch.thumbnail} className="w-12 h-12 rounded-full" alt={ch.channel_name} />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Youtube className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{ch.channel_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(ch.subscribers || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{(ch.views || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Video className="w-3 h-3" />{ch.videos || 0} vídeos</span>
                    </div>
                    {ch.niche && <Badge variant="secondary" className="mt-1 text-[10px]">{ch.niche}</Badge>}
                  </div>
                  <div className="shrink-0">
                    {ch.videos <= 5 ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Canal Novo</Badge>
                    ) : (
                      <Badge className="bg-blue-500/10 text-blue-400 border-0 text-[10px]">Com Conteúdo</Badge>
                    )}
                  </div>
                  {wizard.channelId === ch.id && (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Channel Analysis Preview */}
          {analyzingChannel && (
            <Card className="border-primary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analisando canal nos bancos de dados...</span>
              </CardContent>
            </Card>
          )}

          {channelAnalysis && !analyzingChannel && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Análise do Canal
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <p className="text-lg font-bold">{channelAnalysis.channelStats.isNew ? '🆕' : '📊'}</p>
                    <p className="text-[10px] text-muted-foreground">{channelAnalysis.channelStats.isNew ? 'Canal Novo' : 'Com Histórico'}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <p className="text-lg font-bold">{channelAnalysis.topDNA.length}</p>
                    <p className="text-[10px] text-muted-foreground">DNAs Analisados</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <p className="text-lg font-bold">{channelAnalysis.nicheData.length}</p>
                    <p className="text-[10px] text-muted-foreground">Nichos Mapeados</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <p className="text-lg font-bold">{channelAnalysis.intelligence ? '✅' : '❌'}</p>
                    <p className="text-[10px] text-muted-foreground">Intel Disponível</p>
                  </div>
                </div>
                {channelAnalysis.intelligence?.viral_patterns && (
                  <p className="text-[11px] text-muted-foreground">
                    Padrões virais detectados no sistema serão usados para personalizar o plano.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Button
            onClick={() => setStep(1)}
            disabled={!wizard.channelId}
            className="w-full"
            size="lg"
          >
            Próximo: Escolher Formato <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Step 1: Choose Format */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-center mb-4">Que tipo de conteúdo você vai produzir?</h2>
          
          <div className="grid gap-3">
            {FORMAT_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const selected = wizard.format === opt.value;
              return (
                <Card
                  key={opt.value}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    selected ? 'border-primary ring-2 ring-primary/20' : ''
                  }`}
                  onClick={() => setWizard(prev => ({ ...prev, format: opt.value }))}
                >
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className="text-[10px]">🎯 {opt.ypp}</Badge>
                        <Badge variant="secondary" className="text-[10px]">✨ {opt.best}</Badge>
                      </div>
                    </div>
                    {selected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-1" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Nicho (ajuste se necessário)</label>
            <Input
              value={wizard.customNiche}
              onChange={e => setWizard(prev => ({ ...prev, customNiche: e.target.value }))}
              placeholder="Ex: curiosidades, terror, mitologia..."
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>
            <Button onClick={() => setStep(2)} className="flex-1">
              Próximo: Confirmar <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Confirm & Generate */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-center mb-4">Confirme e gere seu plano</h2>

          <Card className="border-primary/20">
            <CardContent className="p-6 space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4">
                {wizard.channel?.thumbnail ? (
                  <img src={wizard.channel.thumbnail} className="w-14 h-14 rounded-full" alt="" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <Youtube className="w-7 h-7 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-lg">{wizard.channel?.channel_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{wizard.customNiche || wizard.channel?.niche || 'Geral'}</Badge>
                    <Badge variant="outline" className="text-xs">
                      {wizard.format === 'shorts' ? '⚡ Shorts' : wizard.format === 'long' ? '🎬 Longform' : '🔄 Híbrido'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Video className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      {wizard.format === 'shorts' ? '60+ Shorts' : wizard.format === 'long' ? '15+ Vídeos' : '30+ Shorts + 8+ Longos'}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">em 30 dias</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">1.000 Subs</p>
                    <p className="text-[10px] text-muted-foreground/70">meta YPP</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Eye className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      {wizard.format === 'shorts' ? '10M Views' : '4.000h Watch'}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {wizard.format === 'shorts' ? '90 dias' : 'tempo total'}
                    </p>
                  </div>
                </div>
              </div>

              {/* What the AI will do */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-medium mb-2">🧠 A IA vai considerar:</p>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li>• Dados reais do seu canal ({wizard.channel?.subscribers?.toLocaleString()} subs, {wizard.channel?.videos} vídeos)</li>
                  {channelAnalysis?.intelligence && <li>• Intelligence de canal do sistema (padrões virais, estilo)</li>}
                  {(channelAnalysis?.topDNA?.length || 0) > 0 && <li>• {channelAnalysis.topDNA.length} DNAs de conteúdo analisados</li>}
                  {(channelAnalysis?.nicheData?.length || 0) > 0 && <li>• Dados de nicho do banco (RPM, saturação, dificuldade)</li>}
                  <li>• Cases de sucesso reais de monetização</li>
                  <li>• Estratégias validadas do Knowledge Base</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>
            <Button
              onClick={generatePlan}
              disabled={generating}
              className="flex-1"
              size="lg"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando plano personalizado...</>
              ) : (
                <><Rocket className="w-4 h-4 mr-2" /> Gerar Meu Plano de 30 Dias</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
