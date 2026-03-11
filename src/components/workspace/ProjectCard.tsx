import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Film, Clock, MoreVertical, Trash2, Edit3, Upload, CheckCircle2, ChevronDown, ChevronUp, Users, Eye, Wand2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

export type ProjectStatus = 'draft' | 'script' | 'scenes' | 'published';

export const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: React.ElementType; step: number }> = {
  draft: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: Edit3, step: 1 },
  script: { label: 'Roteiro Pronto', color: 'bg-primary/20 text-primary', icon: FileText, step: 2 },
  scenes: { label: 'Cenas Geradas', color: 'bg-accent/20 text-accent', icon: Film, step: 3 },
  published: { label: 'Publicado', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle2, step: 4 },
};

const STEPS = [
  { key: 'draft', label: 'Ideia', icon: Edit3 },
  { key: 'script', label: 'Roteiro', icon: FileText },
  { key: 'scenes', label: 'Cenas', icon: Film },
  { key: 'published', label: 'Publicado', icon: Upload },
];

export interface ProjectData {
  id: string;
  title: string;
  niche: string | null;
  status: string | null;
  script: string | null;
  created_at: string | null;
  updated_at: string | null;
  duration_seconds: number | null;
  channel_id: string | null;
  scene_count: number;
  character_count: number;
}

interface UserChannel {
  id: string;
  channel_name: string;
  thumbnail: string | null;
  niche: string | null;
}

interface ProjectCardProps {
  project: ProjectData;
  index: number;
  channels: UserChannel[];
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: ProjectStatus) => void;
  onLinkChannel: (projectId: string, channelId: string | null) => void;
}

export const ProjectCard = ({ project, index, channels, onDelete, onUpdateStatus, onLinkChannel }: ProjectCardProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const status = (project.status || 'draft') as ProjectStatus;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const hasScript = !!project.script && project.script.length > 50;
  const hasScenes = project.scene_count > 0;
  const progressValue = config.step * 25;
  const linkedChannel = channels.find(c => c.id === project.channel_id);

  const getNextAction = () => {
    if (status === 'draft') return { label: 'Criar Roteiro', icon: FileText, action: () => navigate(`/scripts?projectId=${project.id}&niche=${encodeURIComponent(project.niche || '')}`) };
    if (status === 'script' && hasScript) return { label: 'Gerar Cenas', icon: Film, action: () => navigate(`/scripts?projectId=${project.id}`) };
    if (status === 'scenes' && hasScenes) return { label: 'Abrir Studio', icon: Wand2, action: () => navigate(`/scripts?projectId=${project.id}`) };
    return null;
  };

  const nextAction = getNextAction();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.03 }}
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/20 transition-all group"
    >
      {/* Main Row */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(prev => !prev)}>
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
            <config.icon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground truncate max-w-[300px]">{project.title || 'Sem título'}</h3>
              <Badge className={`text-[9px] shrink-0 ${config.color}`}>{config.label}</Badge>
              {project.niche && <Badge variant="outline" className="text-[9px] shrink-0">{project.niche}</Badge>}
              {linkedChannel && (
                <Badge variant="secondary" className="text-[9px] shrink-0 gap-1">
                  {linkedChannel.thumbnail && <img src={linkedChannel.thumbnail} className="w-3 h-3 rounded-full" alt="" />}
                  {linkedChannel.channel_name}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {project.updated_at ? new Date(project.updated_at).toLocaleDateString('pt-BR') : '—'}
              </span>
              {hasScript && <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-primary" /> Roteiro</span>}
              {hasScenes && <span className="flex items-center gap-1"><Film className="w-3 h-3 text-accent" /> {project.scene_count} cenas</span>}
              {project.character_count > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {project.character_count} personagens</span>}
              {project.duration_seconds ? <span>{Math.round(project.duration_seconds / 60)} min</span> : null}
            </div>

            {/* Mini Progress Stepper */}
            <div className="flex items-center gap-1">
              {STEPS.map((step, i) => {
                const isActive = config.step >= (i + 1);
                return (
                  <div key={step.key} className="flex items-center gap-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isActive ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground/40'}`}>
                      <step.icon className="w-2.5 h-2.5" />
                    </div>
                    {i < STEPS.length - 1 && <div className={`w-4 h-0.5 ${isActive ? 'bg-primary/30' : 'bg-border'}`} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            {nextAction && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={nextAction.action}>
                <nextAction.icon className="w-3 h-3" /> {nextAction.label}
              </Button>
            )}

            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setExpanded(prev => !prev)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                  <DropdownMenuItem key={key} onClick={() => onUpdateStatus(project.id, key as ProjectStatus)}
                    className={status === key ? 'bg-primary/10' : ''}>
                    <val.icon className="w-3.5 h-3.5 mr-2" /> {val.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Canal</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onLinkChannel(project.id, null)} className={!project.channel_id ? 'bg-primary/10' : ''}>
                  <Link2 className="w-3.5 h-3.5 mr-2" /> Nenhum
                </DropdownMenuItem>
                {channels.map(ch => (
                  <DropdownMenuItem key={ch.id} onClick={() => onLinkChannel(project.id, ch.id)}
                    className={project.channel_id === ch.id ? 'bg-primary/10' : ''}>
                    {ch.thumbnail && <img src={ch.thumbnail} className="w-3.5 h-3.5 rounded-full mr-2" alt="" />}
                    {ch.channel_name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(project.id)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Deletar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Expanded Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-4 bg-secondary/30 space-y-4">
              {/* Script Preview */}
              {hasScript && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Roteiro
                  </h4>
                  <p className="text-xs text-foreground/80 bg-background rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {project.script!.slice(0, 500)}{project.script!.length > 500 ? '…' : ''}
                  </p>
                </div>
              )}

              {/* Scene / Character counts */}
              <div className="flex gap-4">
                <div className="bg-background rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-accent">{project.scene_count}</p>
                  <p className="text-[10px] text-muted-foreground">Cenas</p>
                </div>
                <div className="bg-background rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-primary">{project.character_count}</p>
                  <p className="text-[10px] text-muted-foreground">Personagens</p>
                </div>
                {project.duration_seconds ? (
                  <div className="bg-background rounded-lg px-3 py-2 text-center">
                    <p className="text-lg font-bold text-foreground">{Math.round(project.duration_seconds / 60)}</p>
                    <p className="text-[10px] text-muted-foreground">Min</p>
                  </div>
                ) : null}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="text-xs gap-1"
                  onClick={() => navigate(`/scripts?projectId=${project.id}`)}>
                  <FileText className="w-3 h-3" /> Abrir no Scripts
                </Button>
                {hasScript && (
                  <Button size="sm" variant="outline" className="text-xs gap-1"
                    onClick={() => navigate(`/scripts?projectId=${project.id}`)}>
                    <Eye className="w-3 h-3" /> Ver Roteiro Completo
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
