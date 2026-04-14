import { useState, useEffect } from 'react';
import { Pencil, Plus, Save, X, Loader2, BookOpen, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NicheTemplate {
  id: string;
  niche: string;
  style: string;
  display_name: string;
  hook_guidelines: string | null;
  tone_rules: string | null;
  forbidden_patterns: string[] | null;
  example_hooks: string[] | null;
  system_prompt_addition: string | null;
  pacing_notes: string | null;
  emotional_arc_template: string | null;
  effectiveness_score: number | null;
  is_active: boolean;
}

export const NicheSkillTemplates = () => {
  const [templates, setTemplates] = useState<NicheTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<NicheTemplate>>({});
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('niche_skill_templates')
      .select('*')
      .order('niche');
    setTemplates((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (t: NicheTemplate) => {
    setEditingId(t.id);
    setEditData({ ...t });
  };

  const saveEdit = async () => {
    if (!editingId || !editData) return;
    const { error } = await supabase
      .from('niche_skill_templates')
      .update({
        display_name: editData.display_name,
        hook_guidelines: editData.hook_guidelines,
        tone_rules: editData.tone_rules,
        forbidden_patterns: editData.forbidden_patterns,
        example_hooks: editData.example_hooks,
        system_prompt_addition: editData.system_prompt_addition,
        pacing_notes: editData.pacing_notes,
        emotional_arc_template: editData.emotional_arc_template,
        is_active: editData.is_active,
      })
      .eq('id', editingId);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Template atualizado!');
      setEditingId(null);
      load();
    }
  };

  const addNew = async () => {
    if (!editData.niche || !editData.display_name) {
      toast.error('Nicho e nome são obrigatórios');
      return;
    }
    const { error } = await supabase
      .from('niche_skill_templates')
      .insert({
        niche: editData.niche?.toLowerCase(),
        style: editData.style || 'all',
        display_name: editData.display_name,
        hook_guidelines: editData.hook_guidelines,
        tone_rules: editData.tone_rules,
        system_prompt_addition: editData.system_prompt_addition,
        forbidden_patterns: editData.forbidden_patterns || [],
        example_hooks: editData.example_hooks || [],
      });

    if (error) {
      toast.error('Erro ao criar: ' + error.message);
    } else {
      toast.success('Template criado!');
      setAdding(false);
      setEditData({});
      load();
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const isEditing = (id: string) => editingId === id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Skill Templates por Nicho
          </h3>
          <p className="text-xs text-muted-foreground">Prompts especializados injetados automaticamente na geração de roteiros</p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-primary/20 text-primary">{templates.length} templates</Badge>
          <Button size="sm" onClick={() => { setAdding(true); setEditData({}); }} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> Novo
          </Button>
        </div>
      </div>

      {/* Add new form */}
      {adding && (
        <Card className="p-4 border-primary/30 space-y-3">
          <h4 className="font-semibold text-sm">Novo Template</h4>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Nicho (ex: terror)" value={editData.niche || ''} onChange={e => setEditData(d => ({ ...d, niche: e.target.value }))} className="text-xs" />
            <Input placeholder="Style (all = padrão)" value={editData.style || 'all'} onChange={e => setEditData(d => ({ ...d, style: e.target.value }))} className="text-xs" />
            <Input placeholder="Nome (ex: 🎃 Terror)" value={editData.display_name || ''} onChange={e => setEditData(d => ({ ...d, display_name: e.target.value }))} className="text-xs" />
          </div>
          <Textarea placeholder="Diretrizes de Hook" value={editData.hook_guidelines || ''} onChange={e => setEditData(d => ({ ...d, hook_guidelines: e.target.value }))} className="text-xs min-h-[60px]" />
          <Textarea placeholder="Regras de Tom" value={editData.tone_rules || ''} onChange={e => setEditData(d => ({ ...d, tone_rules: e.target.value }))} className="text-xs min-h-[60px]" />
          <Textarea placeholder="Adição ao System Prompt" value={editData.system_prompt_addition || ''} onChange={e => setEditData(d => ({ ...d, system_prompt_addition: e.target.value }))} className="text-xs min-h-[80px]" />
          <div className="flex gap-2">
            <Button size="sm" onClick={addNew} className="text-xs gap-1"><Save className="w-3 h-3" /> Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="text-xs gap-1"><X className="w-3 h-3" /> Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Templates list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.map(t => (
          <Card key={t.id} className={`p-4 space-y-2 ${!t.is_active ? 'opacity-50' : ''} ${isEditing(t.id) ? 'border-primary' : ''}`}>
            {isEditing(t.id) ? (
              <div className="space-y-2">
                <Input value={editData.display_name || ''} onChange={e => setEditData(d => ({ ...d, display_name: e.target.value }))} className="text-sm font-semibold" />
                <Textarea placeholder="Diretrizes de Hook" value={editData.hook_guidelines || ''} onChange={e => setEditData(d => ({ ...d, hook_guidelines: e.target.value }))} className="text-xs min-h-[60px]" />
                <Textarea placeholder="Regras de Tom" value={editData.tone_rules || ''} onChange={e => setEditData(d => ({ ...d, tone_rules: e.target.value }))} className="text-xs min-h-[60px]" />
                <Textarea placeholder="Padrões Proibidos (1 por linha)" value={(editData.forbidden_patterns || []).join('\n')} onChange={e => setEditData(d => ({ ...d, forbidden_patterns: e.target.value.split('\n').filter(Boolean) }))} className="text-xs min-h-[40px]" />
                <Textarea placeholder="Hooks de Exemplo (1 por linha)" value={(editData.example_hooks || []).join('\n')} onChange={e => setEditData(d => ({ ...d, example_hooks: e.target.value.split('\n').filter(Boolean) }))} className="text-xs min-h-[40px]" />
                <Textarea placeholder="System Prompt Addition" value={editData.system_prompt_addition || ''} onChange={e => setEditData(d => ({ ...d, system_prompt_addition: e.target.value }))} className="text-xs min-h-[80px]" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} className="text-xs gap-1"><Save className="w-3 h-3" /> Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-xs gap-1"><X className="w-3 h-3" /> Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{t.display_name}</h4>
                    <Badge variant="outline" className="text-[9px]">{t.niche}/{t.style}</Badge>
                    {!t.is_active && <Badge variant="destructive" className="text-[8px]">Inativo</Badge>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(t)} className="h-6 w-6 p-0">
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
                {t.hook_guidelines && (
                  <div className="bg-primary/5 rounded-lg p-2">
                    <p className="text-[9px] text-muted-foreground font-medium mb-0.5">🎣 Hook:</p>
                    <p className="text-[10px] text-foreground">{t.hook_guidelines.slice(0, 120)}...</p>
                  </div>
                )}
                {t.tone_rules && (
                  <p className="text-[10px] text-muted-foreground">🎤 {t.tone_rules.slice(0, 100)}...</p>
                )}
                {t.example_hooks && t.example_hooks.length > 0 && (
                  <p className="text-[10px] text-muted-foreground italic">💡 "{t.example_hooks[0].slice(0, 80)}..."</p>
                )}
                {t.forbidden_patterns && t.forbidden_patterns.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.forbidden_patterns.slice(0, 3).map((p, i) => (
                      <Badge key={i} variant="destructive" className="text-[8px]">🚫 {p}</Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
