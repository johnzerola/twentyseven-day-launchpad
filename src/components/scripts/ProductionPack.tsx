import { useState, useMemo } from 'react';
import { Copy, Download, Package, Check, FileText, Film, Mic, Sparkles, Image, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getExpectedSceneCount } from '@/lib/audio-concat';
import type { SyncedScene, Character } from './types';

interface ProductionPackProps {
  topic: string;
  script: string;
  selectedTitle: string;
  niche: string;
  language: string;
  videoStyle: string;
  duration: string;
  syncedScenes: SyncedScene[];
  characters: Character[];
  generatedAudioUrl: string;
  seoDescription?: string;
  seoTags?: string[];
  seoHashtags?: string[];
  /** Real audio duration in seconds (measured via AudioContext) */
  audioDurationSeconds?: number;
}

const Section = ({ title, icon: Icon, badge, badgeColor, children, defaultOpen = true }: {
  title: string; icon: any; badge?: string; badgeColor?: string; children: React.ReactNode; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{title}</span>
          {badge && <Badge variant="outline" className={`text-[10px] ${badgeColor || ''}`}>{badge}</Badge>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 text-sm">{children}</div>}
    </div>
  );
};

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs gap-1">
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  );
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const ProductionPack = ({
  topic, script, selectedTitle, niche, language, videoStyle,
  duration, syncedScenes, characters, generatedAudioUrl,
  seoDescription, seoTags, seoHashtags, audioDurationSeconds,
}: ProductionPackProps) => {
  const [copiedAll, setCopiedAll] = useState(false);

  const finalTitle = selectedTitle || topic;
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const estimatedMinutes = Math.round(wordCount / 150);
  const requestedMinutes = parseInt(duration, 10) || 8;
  const requestedSeconds = requestedMinutes * 60;

  // Real or estimated duration
  const realDurationSec = audioDurationSeconds || Math.round((wordCount / 150) * 60);
  const hasRealDuration = !!audioDurationSeconds && audioDurationSeconds > 0;
  const expectedScenes = getExpectedSceneCount(realDurationSec);
  const sceneCoverage = expectedScenes > 0 ? Math.round((syncedScenes.length / expectedScenes) * 100) : 0;
  
  // Duration health checks
  const durationMet = realDurationSec >= requestedSeconds * 0.85;
  const scenesCoverageOk = sceneCoverage >= 80;

  const sections = useMemo(() => ({
    script: !!script,
    audio: !!generatedAudioUrl,
    scenes: syncedScenes.length > 0,
    title: !!selectedTitle,
    seo: !!(seoDescription || seoTags?.length),
  }), [script, generatedAudioUrl, syncedScenes.length, selectedTitle, seoDescription, seoTags]);

  const completedCount = Object.values(sections).filter(Boolean).length;
  const totalSections = Object.keys(sections).length;

  const visualDNA = useMemo(() => {
    if (syncedScenes.length === 0) return null;
    const counts = (arr: (string | undefined)[]) => {
      const map: Record<string, number> = {};
      arr.filter(Boolean).forEach(v => { map[v!] = (map[v!] || 0) + 1; });
      return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    };
    return {
      lighting: counts(syncedScenes.map(s => s.lightingSetup)),
      mood: counts(syncedScenes.map(s => s.mood)),
      lens: counts(syncedScenes.map(s => s.lensSpec)),
      camera: counts(syncedScenes.map(s => s.cameraAngle)),
    };
  }, [syncedScenes]);

  const buildFullPack = () => {
    const lines: string[] = [];
    const sep = '═'.repeat(50);

    lines.push(sep);
    lines.push(`📦 PRODUCTION PACK — ${finalTitle}`);
    lines.push(`Nicho: ${niche} | Idioma: ${language} | Duração: ${duration}min | Estilo: ${videoStyle}`);
    lines.push(`Palavras: ${wordCount} | Áudio: ${formatDuration(realDurationSec)} | Cenas: ${syncedScenes.length}/${expectedScenes}`);
    lines.push(sep);

    lines.push('\n🎯 TÍTULO FINAL:');
    lines.push(finalTitle);
    if (seoDescription) {
      lines.push('\n📝 DESCRIÇÃO SEO:');
      lines.push(seoDescription);
    }
    if (seoTags?.length) {
      lines.push('\n🏷️ TAGS:');
      lines.push(seoTags.join(', '));
    }
    if (seoHashtags?.length) {
      lines.push('\n# HASHTAGS:');
      lines.push(seoHashtags.join(' '));
    }

    lines.push(`\n${sep}`);
    lines.push('📜 ROTEIRO COMPLETO:');
    lines.push(sep);
    lines.push(script);

    if (characters.length > 0) {
      lines.push(`\n${sep}`);
      lines.push('👥 PERSONAGENS:');
      lines.push(sep);
      characters.forEach(c => {
        const a: Record<string, string> = (c.appearance || {}) as any;
        const cl: Record<string, string> = (c.clothing || {}) as any;
        lines.push(`\n[${c.name}]: ${c.gender}, ~${c.age} anos, ${a.body_type || 'médio'}. Pele: ${a.skin_color || 'média'}. Cabelo: ${a.hair_color || 'escuro'} ${a.hair_style || 'curto'}. Olhos: ${a.eye_color || 'castanhos'}. Roupa: ${cl.shirt || 'casual'}, ${cl.pants || 'jeans'}.`);
      });
    }

    if (syncedScenes.length > 0) {
      lines.push(`\n${sep}`);
      lines.push('🎬 PROMPTS VISUAIS (Veo3/Midjourney):');
      lines.push(sep);

      if (visualDNA) {
        lines.push(`\n🎨 DNA VISUAL GLOBAL:`);
        lines.push(`Iluminação: ${visualDNA.lighting} | Mood: ${visualDNA.mood} | Lente: ${visualDNA.lens} | Câmera: ${visualDNA.camera}`);
      }

      syncedScenes.forEach((scene, i) => {
        const timeStart = `${String(Math.floor((scene.startTime || 0) / 60)).padStart(2, '0')}:${String(Math.floor((scene.startTime || 0) % 60)).padStart(2, '0')}`;
        const timeEnd = `${String(Math.floor((scene.endTime || 0) / 60)).padStart(2, '0')}:${String(Math.floor((scene.endTime || 0) % 60)).padStart(2, '0')}`;
        lines.push(`\n[CENA ${i + 1}/${syncedScenes.length}] ${timeStart}-${timeEnd}`);
        lines.push(scene.visualPrompt);
        if (scene.negativePrompt) lines.push(`NEGATIVO: ${scene.negativePrompt}`);
      });
    }

    lines.push(`\n${sep}`);
    lines.push(`✅ Pack gerado em ${new Date().toLocaleString('pt-BR')}`);
    lines.push(`📊 Duração real: ${formatDuration(realDurationSec)} | Cobertura: ${sceneCoverage}%`);

    return lines.join('\n');
  };

  const handleCopyAll = () => {
    const pack = buildFullPack();
    navigator.clipboard.writeText(pack);
    setCopiedAll(true);
    toast.success(`📦 Production Pack copiado! (${formatDuration(realDurationSec)} de áudio + ${syncedScenes.length} cenas)`);
    setTimeout(() => setCopiedAll(false), 3000);
  };

  const handleDownload = () => {
    const pack = buildFullPack();
    const blob = new Blob([pack], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-pack-${finalTitle.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('📥 Pack baixado!');
  };

  if (!script) return null;

  return (
    <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-base">📦 Production Pack</h3>
            <p className="text-xs text-muted-foreground">Tudo pronto para produzir — copie e cole</p>
          </div>
        </div>
        <Badge className={completedCount === totalSections ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}>
          {completedCount}/{totalSections} completo
        </Badge>
      </div>

      {/* Duration/Sync alerts */}
      {(!durationMet || !scenesCoverageOk) && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-xs font-semibold text-destructive">Atenção — Verificação de Duração</span>
          </div>
          {!durationMet && (
            <p className="text-[11px] text-destructive/80">
              ⏱️ Áudio real: {formatDuration(realDurationSec)} — Solicitado: {requestedMinutes}min.
              {hasRealDuration ? ' O áudio ficou mais curto que o esperado.' : ' Duração estimada por palavras.'}
            </p>
          )}
          {!scenesCoverageOk && syncedScenes.length > 0 && (
            <p className="text-[11px] text-destructive/80">
              🎬 Cenas: {syncedScenes.length}/{expectedScenes} ({sceneCoverage}% cobertura). Algumas partes do vídeo podem ficar sem cena visual.
            </p>
          )}
        </div>
      )}

      {/* Completion indicators */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'script', label: 'Roteiro', icon: FileText, done: sections.script },
          { key: 'audio', label: 'Áudio', icon: Mic, done: sections.audio },
          { key: 'scenes', label: 'Cenas', icon: Film, done: sections.scenes },
          { key: 'title', label: 'Título', icon: Sparkles, done: sections.title },
          { key: 'seo', label: 'SEO', icon: Image, done: sections.seo },
        ].map(item => (
          <Badge key={item.key} variant="outline" className={`text-[10px] gap-1 ${item.done ? 'border-emerald-500/40 text-emerald-400' : 'border-muted text-muted-foreground'}`}>
            {item.done ? <Check className="w-3 h-3" /> : <item.icon className="w-3 h-3" />}
            {item.label}
          </Badge>
        ))}
      </div>

      {/* Quick stats — now with REAL duration */}
      <div className="grid grid-cols-5 gap-2 text-center">
        <div className="bg-muted/30 rounded-lg p-2">
          <div className="text-lg font-bold text-foreground">{wordCount.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">palavras</div>
        </div>
        <div className={`rounded-lg p-2 ${durationMet ? 'bg-muted/30' : 'bg-destructive/10'}`}>
          <div className={`text-lg font-bold ${durationMet ? 'text-foreground' : 'text-destructive'}`}>
            {formatDuration(realDurationSec)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {hasRealDuration ? 'áudio real' : '~estimado'}
          </div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2">
          <div className="text-lg font-bold text-foreground">{requestedMinutes}min</div>
          <div className="text-[10px] text-muted-foreground">solicitado</div>
        </div>
        <div className={`rounded-lg p-2 ${scenesCoverageOk || syncedScenes.length === 0 ? 'bg-muted/30' : 'bg-destructive/10'}`}>
          <div className="text-lg font-bold text-foreground">{syncedScenes.length}</div>
          <div className="text-[10px] text-muted-foreground">cenas</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2">
          <div className="text-lg font-bold text-foreground">{characters.length}</div>
          <div className="text-[10px] text-muted-foreground">personagens</div>
        </div>
      </div>

      {/* Expandable sections */}
      <div className="space-y-2">
        <Section title="Título & SEO" icon={Sparkles} badge={selectedTitle ? '✓' : 'pendente'}>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">TÍTULO</span>
                <CopyButton text={finalTitle} label="Título" />
              </div>
              <p className="font-semibold text-foreground">{finalTitle}</p>
            </div>
            {seoDescription && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">DESCRIÇÃO</span>
                  <CopyButton text={seoDescription} label="Descrição" />
                </div>
                <p className="text-muted-foreground text-xs whitespace-pre-wrap">{seoDescription.slice(0, 300)}...</p>
              </div>
            )}
            {seoTags && seoTags.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">TAGS</span>
                  <CopyButton text={seoTags.join(', ')} label="Tags" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {seoTags.slice(0, 10).map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title="Roteiro" icon={FileText} badge={`${wordCount} palavras`} defaultOpen={false}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">~{estimatedMinutes} minutos de narração</span>
            <CopyButton text={script} label="Roteiro" />
          </div>
          <div className="max-h-48 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap bg-muted/20 rounded-lg p-3">
            {script.slice(0, 1500)}
            {script.length > 1500 && '...'}
          </div>
        </Section>

        {syncedScenes.length > 0 && (
          <Section 
            title="Prompts Visuais" 
            icon={Film} 
            badge={`${syncedScenes.length}/${expectedScenes} cenas`}
            badgeColor={scenesCoverageOk ? '' : 'border-destructive/50 text-destructive'}
            defaultOpen={false}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                Cobertura: {sceneCoverage}% — Prompts prontos para Veo3/Midjourney
              </span>
              <CopyButton
                text={syncedScenes.map((s, i) => `[CENA ${i + 1}] ${s.visualPrompt}`).join('\n\n')}
                label="Prompts visuais"
              />
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {syncedScenes.slice(0, 5).map((scene, i) => (
                <div key={i} className="bg-muted/20 rounded-lg p-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Cena {i + 1}:</span> {scene.visualPrompt.slice(0, 150)}...
                </div>
              ))}
              {syncedScenes.length > 5 && (
                <p className="text-[10px] text-muted-foreground text-center">+{syncedScenes.length - 5} cenas (copie tudo para ver)</p>
              )}
            </div>
          </Section>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button onClick={handleCopyAll} className="gap-2 h-12 text-sm font-semibold bg-gradient-to-r from-primary to-accent border-0 text-primary-foreground">
          {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copiedAll ? 'Pack Copiado!' : 'Copiar Tudo'}
        </Button>
        <Button variant="outline" onClick={handleDownload} className="gap-2 h-12 text-sm font-semibold border-primary/30 text-primary hover:bg-primary/10">
          <Download className="w-4 h-4" />
          Baixar .txt
        </Button>
      </div>
    </div>
  );
};
