import { memo, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Clock, Upload, Image as ImageIcon, Play, Video, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pendente' },
  generating: { icon: Loader2, color: 'text-yellow-400', label: 'Gerando' },
  success: { icon: CheckCircle, color: 'text-emerald-400', label: 'Sucesso' },
  failed: { icon: XCircle, color: 'text-destructive', label: 'Falhou' },
};

const VIDEO_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle: { color: 'text-muted-foreground', label: '' },
  generating: { color: 'text-violet-400', label: 'Gerando vídeo...' },
  polling: { color: 'text-violet-400', label: 'Processando...' },
  completed: { color: 'text-emerald-400', label: 'Vídeo pronto' },
  failed: { color: 'text-destructive', label: 'Falhou' },
};

export interface Segment {
  index: number;
  text: string;
  visualPrompt: string;
  referenceImage: string | null;
  generatedImage: string | null;
  audioBase64: string | null;
  status: 'pending' | 'generating' | 'success' | 'failed';
  // Video fields
  videoUrl?: string | null;
  videoBase64?: string | null;
  videoStatus?: 'idle' | 'generating' | 'polling' | 'completed' | 'failed';
  videoOperationName?: string | null;
}

interface SegmentCardProps {
  seg: Segment;
  onUpdateSegment: (index: number, field: keyof Segment, value: any) => void;
  onGenerateImage: (seg: Segment) => void;
  onGenerateVideo?: (seg: Segment) => void;
  generatingImage: number | null;
  batchRunning: boolean;
  veo3Mode?: boolean;
}

const SegmentCard = memo(({ seg, onUpdateSegment, onGenerateImage, onGenerateVideo, generatingImage, batchRunning, veo3Mode }: SegmentCardProps) => {
  const statusCfg = STATUS_CONFIG[seg.status];
  const StatusIcon = statusCfg.icon;
  const videoStatus = seg.videoStatus || 'idle';
  const videoStatusCfg = VIDEO_STATUS_CONFIG[videoStatus];

  const playAudio = () => {
    if (!seg.audioBase64) return;
    const audio = new Audio(`data:audio/mpeg;base64,${seg.audioBase64}`);
    audio.play();
  };

  const videoSrc = seg.videoUrl || (seg.videoBase64 ? `data:video/mp4;base64,${seg.videoBase64}` : null);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: seg.index * 0.03 }}
      className={`glass rounded-xl p-4 space-y-3 relative ${
        seg.status === 'generating' ? 'border-yellow-400/30' :
        seg.status === 'success' ? 'border-emerald-400/30' :
        seg.status === 'failed' ? 'border-destructive/30' : ''
      }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-secondary text-xs font-mono px-2 py-0.5 rounded">#{seg.index + 1}</span>
          <span className="text-xs text-muted-foreground">8s</span>
          {seg.audioBase64 && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={playAudio}>
              <Play className="w-3 h-3 text-emerald-400" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {videoStatus !== 'idle' && (
            <Badge variant="outline" className={`gap-1 text-[10px] ${videoStatusCfg.color}`}>
              {(videoStatus === 'generating' || videoStatus === 'polling') && <Loader2 className="w-3 h-3 animate-spin" />}
              {videoStatus === 'completed' && <Video className="w-3 h-3" />}
              {videoStatusCfg.label}
            </Badge>
          )}
          <Badge variant="outline" className={`gap-1 ${statusCfg.color}`}>
            <StatusIcon className={`w-3 h-3 ${seg.status === 'generating' ? 'animate-spin' : ''}`} />
            {statusCfg.label}
          </Badge>
        </div>
      </div>

      <div className="bg-secondary/30 rounded-lg p-3">
        <p className="text-sm">{seg.text}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Prompt Visual da Cena</label>
          <Input placeholder="Ex: Close-up do personagem na chuva..."
            value={seg.visualPrompt} onChange={e => onUpdateSegment(seg.index, 'visualPrompt', e.target.value)}
            className="bg-secondary/50 text-xs h-8" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Imagem IA</label>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1"
              onClick={() => onGenerateImage(seg)}
              disabled={generatingImage === seg.index || batchRunning}>
              <ImageIcon className="w-3 h-3" />
              {generatingImage === seg.index ? 'Gerando...' : 'Gerar'}
            </Button>
          </div>
          {veo3Mode && onGenerateVideo && (
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Vídeo Veo3</label>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1 border-violet-500/30 hover:border-violet-500/60"
                onClick={() => onGenerateVideo(seg)}
                disabled={videoStatus === 'generating' || videoStatus === 'polling' || batchRunning}>
                <Film className="w-3 h-3 text-violet-400" />
                {videoStatus === 'generating' || videoStatus === 'polling' ? 'Gerando...' : 'Vídeo'}
              </Button>
            </div>
          )}
          {!veo3Mode && (
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Referência</label>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1"
                onClick={() => toast.info('Upload de referência (em breve)')}>
                <Upload className="w-3 h-3" /> Upload
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Audio waveform indicator */}
      {seg.audioBase64 && (
        <div className="flex items-center gap-2 bg-emerald-400/10 rounded-lg px-3 py-1.5">
          <Play className="w-3 h-3 text-emerald-400" />
          <div className="flex gap-0.5 items-end h-4">
            {[3, 5, 8, 4, 7, 3, 6, 4, 5, 7, 3, 5, 8, 4, 6].map((h, i) => (
              <div key={i} className="w-0.5 bg-emerald-400/60 rounded-full" style={{ height: `${h * 2}px` }} />
            ))}
          </div>
          <span className="text-[10px] text-emerald-400 ml-auto">Áudio pronto</span>
        </div>
      )}

      {/* Generated Image Preview */}
      {seg.generatedImage && !videoSrc && (
        <div className="rounded-lg overflow-hidden border border-emerald-400/20">
          <img src={seg.generatedImage} alt={`Cena ${seg.index + 1}`}
            className="w-full aspect-video object-cover" />
        </div>
      )}

      {/* Generated Video Preview */}
      {videoSrc && (
        <div className="rounded-lg overflow-hidden border border-violet-500/30">
          <video
            src={videoSrc}
            controls
            className="w-full aspect-video object-cover"
            poster={seg.generatedImage || undefined}
          />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10">
            <Video className="w-3 h-3 text-violet-400" />
            <span className="text-[10px] text-violet-400">Vídeo Veo3 — 8s • 24fps • 1080p</span>
          </div>
        </div>
      )}
    </motion.div>
  );
});

SegmentCard.displayName = 'SegmentCard';
export default SegmentCard;
