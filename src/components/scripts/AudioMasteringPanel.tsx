import { useState, useRef, useCallback, useEffect } from 'react';
import { Headphones, Loader2, Wand2, Download, Play, Pause, RotateCcw, Settings2, CheckCircle2, Zap, Volume2 } from 'lucide-react';
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
  PRESETS,
  PRESET_LABELS,
  type MasteringPhase,
  type MasteringSettings,
  type MasteringStats,
  type MasteringPreset,
} from '@/lib/audioMastering';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AudioMasteringPanelProps {
  audioFile: File | null;
  onMasteredAudio?: (blob: Blob) => void;
}

// ─── Waveform Visualizer ───────────────────────────────────────────

function WaveformDisplay({ data, label, color }: { data: number[]; label: string; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 0.01);
  
  return (
    <div className="space-y-1">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <div className="flex items-end gap-[1px] h-12 bg-secondary/20 rounded-lg p-1 overflow-hidden">
        {data.map((v, i) => (
          <div
            key={i}
            className="flex-1 min-w-[1px] rounded-sm transition-all"
            style={{
              height: `${Math.max(2, (v / max) * 100)}%`,
              backgroundColor: color,
              opacity: 0.6 + (v / max) * 0.4,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export const AudioMasteringPanel = ({ audioFile, onMasteredAudio }: AudioMasteringPanelProps) => {
  const [phase, setPhase] = useState<MasteringPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<MasteringStats | null>(null);
  const [masteredBlob, setMasteredBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preset, setPreset] = useState<MasteringPreset>('youtube');
  const [settings, setSettings] = useState<MasteringSettings>({ ...DEFAULT_MASTERING });
  const [waveformBefore, setWaveformBefore] = useState<number[]>([]);
  const [waveformAfter, setWaveformAfter] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingOriginal, setPlayingOriginal] = useState(false);
  const [abMode, setAbMode] = useState<'A' | 'B'>('B');

  const handlePhaseUpdate = useCallback((p: MasteringPhase, prog: number) => {
    setPhase(p);
    setProgress(prog);
  }, []);

  const applyPreset = (p: MasteringPreset) => {
    setPreset(p);
    if (p !== 'custom') {
      setSettings({ ...PRESETS[p] });
    }
  };

  const runMastering = async () => {
    if (!audioFile) return;
    setStats(null);
    setMasteredBlob(null);
    setWaveformBefore([]);
    setWaveformAfter([]);

    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const result = await masterAudio(arrayBuffer, settings, handlePhaseUpdate);
      
      setMasteredBlob(result.blob);
      setStats(result.stats);
      setWaveformBefore(result.waveformBefore);
      setWaveformAfter(result.waveformAfter);
      onMasteredAudio?.(result.blob);
      toast.success('Masterização concluída! Qualidade superior ao Adobe Podcast.');
    } catch (err: any) {
      setPhase('idle');
      setProgress(0);
      toast.error(err.message || 'Erro na masterização');
    }
  };

  const stopAll = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (originalAudioRef.current) { originalAudioRef.current.pause(); originalAudioRef.current = null; }
    setIsPlaying(false);
    setPlayingOriginal(false);
  };

  const playMastered = () => {
    if (isPlaying) { stopAll(); return; }
    if (!masteredBlob) return;
    stopAll();
    const url = URL.createObjectURL(masteredBlob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
    setAbMode('B');
  };

  const playOriginal = () => {
    if (playingOriginal) { stopAll(); return; }
    if (!audioFile) return;
    stopAll();
    const url = URL.createObjectURL(audioFile);
    const audio = new Audio(url);
    originalAudioRef.current = audio;
    audio.onended = () => setPlayingOriginal(false);
    audio.play();
    setPlayingOriginal(true);
    setAbMode('A');
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

  const updateSetting = (key: keyof MasteringSettings, value: number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setPreset('custom');
  };

  const isProcessing = phase !== 'idle' && phase !== 'done';

  return (
    <div className="border border-border/50 rounded-xl p-4 space-y-4 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-foreground">Audio Mastering Pro</span>
          <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">v5 Engine</Badge>
        </div>
        {stats && (
          <Badge variant="outline" className="gap-1 text-emerald-400 text-[10px]">
            <CheckCircle2 className="w-3 h-3" />
            Masterizado
          </Badge>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Pipeline de 12 estágios: Noise Profiling → Spectral Gate → Breath Reduction → Silence Trim →
        EQ 8-band → Multi-band Compression → De-esser → Saturation → Stereo → Limiter → LUFS → Dithering
      </p>

      {/* Preset Selector */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Preset</span>
        <Select value={preset} onValueChange={(v) => applyPreset(v as MasteringPreset)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PRESET_LABELS) as [MasteringPreset, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quick Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={settings.breathReduction} onCheckedChange={(v) => updateSetting('breathReduction', v)} />
          <span className="text-xs text-muted-foreground">Reduzir respirações</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={settings.minSilenceMs < 99999} onCheckedChange={(v) => {
            updateSetting('minSilenceMs', v ? 280 : 999999);
            updateSetting('maxSilenceMs', v ? 140 : 999999);
          }} />
          <span className="text-xs text-muted-foreground">Remover silêncios</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={settings.dithering} onCheckedChange={(v) => updateSetting('dithering', v)} />
          <span className="text-xs text-muted-foreground">Dithering TPDF</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={settings.saturationAmount > 0} onCheckedChange={(v) => updateSetting('saturationAmount', v ? 20 : 0)} />
          <span className="text-xs text-muted-foreground">Saturação analógica</span>
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
          <Tabs defaultValue="eq" className="w-full">
            <TabsList className="w-full h-8">
              <TabsTrigger value="eq" className="text-[10px] flex-1">🎛️ EQ</TabsTrigger>
              <TabsTrigger value="dynamics" className="text-[10px] flex-1">🔧 Dinâmica</TabsTrigger>
              <TabsTrigger value="color" className="text-[10px] flex-1">🔥 Cor</TabsTrigger>
              <TabsTrigger value="output" className="text-[10px] flex-1">📊 Saída</TabsTrigger>
            </TabsList>

            <TabsContent value="eq" className="space-y-2 bg-secondary/20 rounded-lg p-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <SliderControl label="HPF (Hz)" value={settings.hpfFrequency} min={20} max={150} step={5}
                  onChange={v => updateSetting('hpfFrequency', v)} />
                <SliderControl label="Body Boost (dB)" value={settings.bodyGainDb} min={0} max={6} step={0.5}
                  onChange={v => updateSetting('bodyGainDb', v)} />
                <SliderControl label="Mud Cut 250Hz (dB)" value={Math.abs(settings.mudCut1GainDb)} min={0} max={6} step={0.5}
                  onChange={v => updateSetting('mudCut1GainDb', -v)} suffix=" cut" />
                <SliderControl label="Box Cut 400Hz (dB)" value={Math.abs(settings.mudCut2GainDb)} min={0} max={6} step={0.5}
                  onChange={v => updateSetting('mudCut2GainDb', -v)} suffix=" cut" />
                <SliderControl label="Presence 3kHz (dB)" value={settings.presenceGainDb} min={0} max={5} step={0.5}
                  onChange={v => updateSetting('presenceGainDb', v)} />
                <SliderControl label="Clarity 5kHz (dB)" value={settings.clarityGainDb} min={0} max={4} step={0.5}
                  onChange={v => updateSetting('clarityGainDb', v)} />
                <SliderControl label="Air (dB)" value={settings.airGainDb} min={0} max={6} step={0.5}
                  onChange={v => updateSetting('airGainDb', v)} />
                <SliderControl label="LPF (kHz)" value={settings.lpfFrequency / 1000} min={8} max={20} step={0.5}
                  onChange={v => updateSetting('lpfFrequency', v * 1000)} suffix="k" />
              </div>
            </TabsContent>

            <TabsContent value="dynamics" className="space-y-2 bg-secondary/20 rounded-lg p-3 mt-2">
              <span className="text-[9px] text-muted-foreground">Multi-band Compression (Low / Mid / High)</span>
              <div className="grid grid-cols-2 gap-3">
                <SliderControl label="Low Threshold" value={Math.abs(settings.compLowThreshold)} min={10} max={30} step={1}
                  onChange={v => updateSetting('compLowThreshold', -v)} prefix="-" suffix=" dB" />
                <SliderControl label="Low Ratio" value={settings.compLowRatio} min={1} max={8} step={0.5}
                  onChange={v => updateSetting('compLowRatio', v)} suffix=":1" />
                <SliderControl label="Mid Threshold" value={Math.abs(settings.compMidThreshold)} min={10} max={30} step={1}
                  onChange={v => updateSetting('compMidThreshold', -v)} prefix="-" suffix=" dB" />
                <SliderControl label="Mid Ratio" value={settings.compMidRatio} min={1} max={8} step={0.5}
                  onChange={v => updateSetting('compMidRatio', v)} suffix=":1" />
                <SliderControl label="High Threshold" value={Math.abs(settings.compHighThreshold)} min={10} max={30} step={1}
                  onChange={v => updateSetting('compHighThreshold', -v)} prefix="-" suffix=" dB" />
                <SliderControl label="High Ratio" value={settings.compHighRatio} min={1} max={8} step={0.5}
                  onChange={v => updateSetting('compHighRatio', v)} suffix=":1" />
                <SliderControl label="Noise Reduction" value={settings.noiseReduction} min={0} max={100} step={5}
                  onChange={v => updateSetting('noiseReduction', v)} suffix="%" />
                <SliderControl label="De-esser" value={settings.deEsserIntensity} min={0} max={100} step={5}
                  onChange={v => updateSetting('deEsserIntensity', v)} suffix="%" />
              </div>
            </TabsContent>

            <TabsContent value="color" className="space-y-2 bg-secondary/20 rounded-lg p-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <SliderControl label="Saturation" value={settings.saturationAmount} min={0} max={100} step={5}
                  onChange={v => updateSetting('saturationAmount', v)} suffix="%" />
                <SliderControl label="Warmth" value={settings.saturationWarmth} min={0} max={100} step={5}
                  onChange={v => updateSetting('saturationWarmth', v)} suffix="%" />
                <SliderControl label="Stereo Width" value={settings.stereoWidth} min={0} max={200} step={10}
                  onChange={v => updateSetting('stereoWidth', v)} suffix="%" />
                <SliderControl label="Breath Red. (dB)" value={Math.abs(settings.breathReductionDb)} min={3} max={24} step={1}
                  onChange={v => updateSetting('breathReductionDb', -v)} prefix="-" suffix=" dB" />
              </div>
            </TabsContent>

            <TabsContent value="output" className="space-y-2 bg-secondary/20 rounded-lg p-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <SliderControl label="True Peak" value={Math.abs(settings.limiterThreshold)} min={0.5} max={6} step={0.5}
                  onChange={v => updateSetting('limiterThreshold', -v)} prefix="-" suffix=" dB" />
                <SliderControl label="Target LUFS" value={Math.abs(settings.targetLufs)} min={10} max={24} step={1}
                  onChange={v => updateSetting('targetLufs', -v)} prefix="-" suffix=" LUFS" />
              </div>
            </TabsContent>
          </Tabs>

          <Button variant="ghost" size="sm" className="text-[10px] text-muted-foreground gap-1"
            onClick={() => { setSettings({ ...DEFAULT_MASTERING }); setPreset('youtube'); }}>
            <RotateCcw className="w-3 h-3" /> Resetar para YouTube
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

      {/* Waveform Comparison */}
      {waveformBefore.length > 0 && waveformAfter.length > 0 && (
        <div className="space-y-2">
          <WaveformDisplay data={waveformBefore} label="Antes (Original)" color="hsl(0, 60%, 55%)" />
          <WaveformDisplay data={waveformAfter} label="Depois (Masterizado)" color="hsl(43, 96%, 56%)" />
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
            <Stat label="Respirações Detectadas" value={`${stats.breathsDetected}`} highlight />
            <Stat label="LUFS Original" value={`${stats.originalLufs} LUFS`} />
            <Stat label="LUFS Final" value={`${stats.finalLufs} LUFS`} highlight />
            <Stat label="True Peak" value={`${stats.truePeakDb} dB`} />
            <Stat label="Dynamic Range" value={`${stats.dynamicRange} dB`} />
            <Stat label="Noise Floor" value={`${stats.noiseFloorDb} dB`} />
            <Stat label="Tamanho" value={`${(stats.fileSizeKb / 1024).toFixed(1)} MB`} />
          </div>
        </div>
      )}

      {/* A/B Comparison */}
      {masteredBlob && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Comparação A/B</span>
            <Badge variant={abMode === 'A' ? 'default' : 'outline'} className="text-[9px] cursor-pointer" onClick={playOriginal}>A Original</Badge>
            <Badge variant={abMode === 'B' ? 'default' : 'outline'} className="text-[9px] cursor-pointer bg-amber-500/20 text-amber-400" onClick={playMastered}>B Master</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={playOriginal}>
              {playingOriginal ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              A — Original
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs border-amber-500/30 text-amber-400" onClick={playMastered}>
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              B — Masterizado
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadMastered}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Action */}
      <Button onClick={runMastering} disabled={isProcessing || !audioFile}
        className="w-full gap-2 h-10 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0">
        {isProcessing
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando (12 estágios)...</>
          : <><Wand2 className="w-4 h-4" /> {masteredBlob ? '🔄 Re-masterizar' : '🎛️ Masterizar (Pro Engine v5)'}</>}
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
