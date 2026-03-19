import { useState, useRef, useCallback } from 'react';
import { Headphones, Loader2, Wand2, Download, Play, Pause, RotateCcw, Settings2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  masterAudio,
  DEFAULT_MASTERING,
  MASTERING_PHASE_LABELS,
  type MasteringPhase,
  type MasteringSettings,
  type MasteringStats,
} from '@/lib/audioMastering';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AudioMasteringPanelProps {
  audioFile: File | null;
  onMasteredAudio?: (blob: Blob) => void;
}

export const AudioMasteringPanel = ({ audioFile, onMasteredAudio }: AudioMasteringPanelProps) => {
  const [phase, setPhase] = useState<MasteringPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<MasteringStats | null>(null);
  const [masteredBlob, setMasteredBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [silenceRemoval, setSilenceRemoval] = useState(true);
  const [settings, setSettings] = useState<MasteringSettings>({ ...DEFAULT_MASTERING });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingOriginal, setPlayingOriginal] = useState(false);

  const handlePhaseUpdate = useCallback((p: MasteringPhase, prog: number) => {
    setPhase(p);
    setProgress(prog);
  }, []);

  const runMastering = async () => {
    if (!audioFile) return;
    setStats(null);
    setMasteredBlob(null);

    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const effectiveSettings = {
        ...settings,
        minSilenceMs: silenceRemoval ? settings.minSilenceMs : 999999,
      };
      
      const result = await masterAudio(arrayBuffer, effectiveSettings, handlePhaseUpdate);
      
      setMasteredBlob(result.blob);
      setStats(result.stats);
      onMasteredAudio?.(result.blob);
      toast.success('Masterização concluída! Áudio profissional pronto.');
    } catch (err: any) {
      setPhase('idle');
      setProgress(0);
      toast.error(err.message || 'Erro na masterização');
    }
  };

  const playMastered = () => {
    if (!masteredBlob) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    const url = URL.createObjectURL(masteredBlob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  };

  const playOriginal = () => {
    if (!audioFile) return;
    if (playingOriginal && originalAudioRef.current) {
      originalAudioRef.current.pause();
      setPlayingOriginal(false);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    const audio = new Audio(url);
    originalAudioRef.current = audio;
    audio.onended = () => setPlayingOriginal(false);
    audio.play();
    setPlayingOriginal(true);
  };

  const downloadMastered = () => {
    if (!masteredBlob) return;
    const url = URL.createObjectURL(masteredBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mastered_${audioFile?.name?.replace(/\.[^.]+$/, '') || 'audio'}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isProcessing = phase !== 'idle' && phase !== 'done';

  const updateSetting = (key: keyof MasteringSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="border border-border/50 rounded-xl p-4 space-y-4 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-foreground">Masterização de Áudio</span>
          <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Studio Grade</Badge>
        </div>
        {stats && (
          <Badge variant="outline" className="gap-1 text-emerald-400 text-[10px]">
            <CheckCircle2 className="w-3 h-3" />
            Masterizado
          </Badge>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Pipeline profissional: Denoise → EQ Cirúrgica (HPF 80Hz, Body 135Hz, Box Cut 400Hz, Air 10kHz) → 
        Compressão 4:1 → De-esser 7kHz → Limiter -3dB True Peak → Normalização -14 LUFS
      </p>

      {/* Quick Settings */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={silenceRemoval} onCheckedChange={setSilenceRemoval} />
          <span className="text-xs text-muted-foreground">Remover silêncios mortos</span>
        </div>
      </div>

      {/* Advanced Settings */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs text-muted-foreground hover:text-foreground">
            <span className="flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Configurações Avançadas
            </span>
            <span>{showAdvanced ? '▲' : '▼'}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* EQ Section */}
          <div className="space-y-2 bg-secondary/20 rounded-lg p-3">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Equalização</span>
            
            <div className="grid grid-cols-2 gap-3">
              <SliderControl label="Body Boost (dB)" value={settings.bodyGainDb} min={0} max={6} step={0.5}
                onChange={v => updateSetting('bodyGainDb', v)} />
              <SliderControl label="Box Cut (dB)" value={Math.abs(settings.boxCutGainDb)} min={0} max={6} step={0.5}
                onChange={v => updateSetting('boxCutGainDb', -v)} suffix=" cut" />
              <SliderControl label="Presence (dB)" value={settings.presenceGainDb} min={0} max={4} step={0.5}
                onChange={v => updateSetting('presenceGainDb', v)} />
              <SliderControl label="Air/Brilho (dB)" value={settings.airGainDb} min={0} max={6} step={0.5}
                onChange={v => updateSetting('airGainDb', v)} />
            </div>
          </div>

          {/* Dynamics */}
          <div className="space-y-2 bg-secondary/20 rounded-lg p-3">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Dinâmica</span>
            
            <div className="grid grid-cols-2 gap-3">
              <SliderControl label="Compressor Threshold" value={Math.abs(settings.compressorThreshold)} min={10} max={30} step={1}
                onChange={v => updateSetting('compressorThreshold', -v)} prefix="-" suffix=" dB" />
              <SliderControl label="Ratio" value={settings.compressorRatio} min={2} max={8} step={0.5}
                onChange={v => updateSetting('compressorRatio', v)} suffix=":1" />
            </div>
          </div>

          {/* Output */}
          <div className="space-y-2 bg-secondary/20 rounded-lg p-3">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Saída</span>
            
            <div className="grid grid-cols-2 gap-3">
              <SliderControl label="True Peak" value={Math.abs(settings.limiterThreshold)} min={1} max={6} step={0.5}
                onChange={v => updateSetting('limiterThreshold', -v)} prefix="-" suffix=" dB" />
              <SliderControl label="Target LUFS" value={Math.abs(settings.targetLufs)} min={10} max={20} step={1}
                onChange={v => updateSetting('targetLufs', -v)} prefix="-" suffix=" LUFS" />
            </div>
          </div>

          <Button variant="ghost" size="sm" className="text-[10px] text-muted-foreground gap-1"
            onClick={() => setSettings({ ...DEFAULT_MASTERING })}>
            <RotateCcw className="w-3 h-3" /> Resetar para padrão
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Progress */}
      {phase !== 'idle' && phase !== 'done' && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground animate-pulse">
            {MASTERING_PHASE_LABELS[phase]}
          </p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">📊 Resultado da Masterização</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            <Stat label="Duração Original" value={`${stats.originalDurationSec.toFixed(1)}s`} />
            <Stat label="Duração Final" value={`${stats.finalDurationSec.toFixed(1)}s`} />
            <Stat label="Silêncio Removido" value={`${(stats.silenceRemovedMs / 1000).toFixed(1)}s`} highlight />
            <Stat label="LUFS Original" value={`${stats.originalLufs} LUFS`} />
            <Stat label="LUFS Final" value={`${stats.finalLufs} LUFS`} highlight />
            <Stat label="True Peak" value={`${stats.truePeakDb} dB`} />
            <Stat label="Tamanho" value={`${(stats.fileSizeKb / 1024).toFixed(1)} MB`} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {masteredBlob && (
          <>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={playOriginal}>
              {playingOriginal ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              Original
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs border-amber-500/30 text-amber-400" onClick={playMastered}>
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              Masterizado
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadMastered}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Main Action */}
      <Button onClick={runMastering} disabled={isProcessing || !audioFile}
        className="w-full gap-2 h-10 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0">
        {isProcessing
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
          : <><Wand2 className="w-4 h-4" /> {masteredBlob ? '🔄 Re-masterizar' : '🎛️ Masterizar Áudio (Studio Grade)'}</>}
      </Button>
    </div>
  );
};

// ─── Helper Components ─────────────────────────────────────────────

function SliderControl({ label, value, min, max, step, onChange, prefix = '', suffix = '' }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-foreground">{prefix}{value}{suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step}
        onValueChange={([v]) => onChange(v)} className="h-4" />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? 'text-amber-400 font-semibold' : 'text-foreground'}>{value}</span>
    </div>
  );
}
