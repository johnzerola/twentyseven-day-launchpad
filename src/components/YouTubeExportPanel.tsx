import { useState } from 'react';
import { Copy, Check, Youtube, FileText, Hash, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface YouTubeExportProps {
  title?: string;
  description?: string;
  tags?: string[];
  hashtags?: string[];
}

export const YouTubeExportPanel = ({ title, description, tags, hashtags }: YouTubeExportProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyField = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    toast.success(`${field} copiado!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAll = () => {
    const parts = [];
    if (title) parts.push(`TÍTULO:\n${title}`);
    if (description) parts.push(`DESCRIÇÃO:\n${description}`);
    if (tags?.length) parts.push(`TAGS:\n${tags.join(', ')}`);
    if (hashtags?.length) parts.push(`HASHTAGS:\n${hashtags.join(' ')}`);
    navigator.clipboard.writeText(parts.join('\n\n'));
    toast.success('Tudo copiado para o clipboard!');
  };

  const CopyBtn = ({ field, value }: { field: string; value: string }) => (
    <Button size="sm" variant="ghost" onClick={() => copyField(value, field)} className="text-xs gap-1 h-7">
      {copiedField === field ? <Check className="w-3 h-3 text-chart-2" /> : <Copy className="w-3 h-3" />}
      {copiedField === field ? 'Copiado!' : 'Copiar'}
    </Button>
  );

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Youtube className="w-4 h-4 text-destructive" /> Export para YouTube
        </h3>
        <Button size="sm" variant="outline" onClick={copyAll} className="text-xs gap-1">
          <Copy className="w-3 h-3" /> Copiar Tudo
        </Button>
      </div>

      {title && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <FileText className="w-3 h-3" /> TÍTULO
            </label>
            <CopyBtn field="Título" value={title} />
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-sm font-medium">{title}</div>
          <p className="text-[9px] text-muted-foreground mt-1">{title.length} caracteres {title.length > 100 ? '⚠️ muito longo' : title.length > 70 ? '⚠️ considere encurtar' : '✅ bom tamanho'}</p>
        </div>
      )}

      {description && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <FileText className="w-3 h-3" /> DESCRIÇÃO
            </label>
            <CopyBtn field="Descrição" value={description} />
          </div>
          <Textarea value={description} readOnly rows={6} className="bg-secondary/50 text-xs font-mono" />
        </div>
      )}

      {tags && tags.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <Tag className="w-3 h-3" /> TAGS ({tags.length})
            </label>
            <CopyBtn field="Tags" value={tags.join(', ')} />
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] cursor-pointer hover:bg-secondary"
                onClick={() => copyField(tag, `Tag-${i}`)}>
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {hashtags && hashtags.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <Hash className="w-3 h-3" /> HASHTAGS
            </label>
            <CopyBtn field="Hashtags" value={hashtags.join(' ')} />
          </div>
          <div className="flex flex-wrap gap-1">
            {hashtags.map((h, i) => (
              <Badge key={i} className="bg-primary/20 text-primary text-[10px] cursor-pointer"
                onClick={() => copyField(h, `Hash-${i}`)}>
                {h}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {!title && !description && !tags?.length && (
        <div className="text-center py-6 text-muted-foreground">
          <Youtube className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Gere títulos e descrições SEO para exportar</p>
        </div>
      )}
    </div>
  );
};
