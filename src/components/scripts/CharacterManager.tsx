import { useState } from 'react';
import { Users, Trash2, Loader2, Wand2, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import type { Character, VideoStyleOption } from './types';

interface CharacterManagerProps {
  script: string;
  characters: Character[];
  setCharacters: (chars: Character[]) => void;
  videoStyle: string;
  videoStyles: VideoStyleOption[];
  language: string;
  getOrCreateProject: () => Promise<string>;
  getCleanNarration: () => string;
  setActiveStep: (v: 'script' | 'style' | 'characters' | 'prompts') => void;
}

export const CharacterManager = ({
  script, characters, setCharacters, videoStyle, videoStyles,
  language, getOrCreateProject, getCleanNarration, setActiveStep,
}: CharacterManagerProps) => {
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [newCharAppearance, setNewCharAppearance] = useState('');
  const [newCharClothing, setNewCharClothing] = useState('');
  const [detectingCharacters, setDetectingCharacters] = useState(false);

  const buildCharImagePrompt = (char: Character): string => {
    const a = char.appearance;
    const f = char.facial_features;
    const cl = char.clothing;
    return `Character reference sheet. ${char.gender}, ${char.age} years old. ${a.skin_color} skin, ${a.hair_color} ${a.hair_style} hair, ${a.eye_color} eyes. ${a.body_type} build, ${a.height}. Face: ${f.face_shape} face, ${f.eyebrows} eyebrows, ${f.nose} nose, ${f.mouth}, ${f.ears} ears. Wearing ${cl.shirt}, ${cl.pants}, ${cl.shoes}${cl.accessories !== 'none' ? `, ${cl.accessories}` : ''}. ${char.role}. Full body portrait, clean background, ${videoStyles.find(v => v.value === videoStyle)?.desc || 'cinematic style'}. Highly detailed, consistent character design.`;
  };

  const persistCharacters = async (chars: Character[]) => {
    try {
      const pid = await getOrCreateProject();
      await supabase.from('characters').delete().eq('project_id', pid);
      if (chars.length === 0) return;
      const rows = chars.map(c => ({
        project_id: pid, name: c.name,
        visual_prompt: buildCharImagePrompt(c),
        reference_image_url: null,
        visual_attributes: {
          gender: c.gender, age: c.age, role: c.role,
          appearance: c.appearance, facial_features: c.facial_features,
          clothing: c.clothing, personality: c.personality,
        },
      }));
      await supabase.from('characters').insert(rows as any);
    } catch (err: any) { console.error('Failed to persist characters:', err); }
  };

  const addCharacter = () => {
    if (!newCharName.trim()) return;
    const newChar: Character = {
      name: newCharName.trim(), gender: 'male', age: 30,
      role: newCharDesc.trim() || 'Personagem',
      appearance: { skin_color: 'light tan', hair_color: 'dark brown', hair_style: 'short', eye_color: 'brown', body_type: 'average', height: '1.75m' },
      facial_features: { eyebrows: 'medium arched', nose: 'straight medium', mouth: 'medium lips', ears: 'normal size', face_shape: 'oval' },
      clothing: { shirt: newCharClothing.trim() || 'casual t-shirt', pants: 'dark jeans', shoes: 'sneakers', accessories: 'none' },
      personality: ['determined', 'curious'],
    };
    const updated = [...characters, newChar];
    setCharacters(updated);
    persistCharacters(updated);
    setNewCharName(''); setNewCharDesc(''); setNewCharAppearance(''); setNewCharClothing('');
  };

  const removeCharacter = (idx: number) => {
    const updated = characters.filter((_, i) => i !== idx);
    setCharacters(updated);
    persistCharacters(updated);
  };

  const autoDetectCharacters = async () => {
    const cleanScript = getCleanNarration();
    if (!cleanScript) { toast.error('Gere um roteiro primeiro'); return; }
    setDetectingCharacters(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-characters', { body: { script: cleanScript, language } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const extracted: Character[] = (data.characters || []).map((c: any) => ({
        name: c.name, gender: c.gender || 'male', age: c.age || 30,
        role: c.role || c.description || 'Personagem',
        appearance: c.appearance || { skin_color: 'light', hair_color: 'dark', hair_style: 'short', eye_color: 'brown', body_type: 'average', height: '1.75m' },
        facial_features: c.facial_features || { eyebrows: 'medium', nose: 'straight', mouth: 'medium', ears: 'normal', face_shape: 'oval' },
        clothing: c.clothing || { shirt: 'casual shirt', pants: 'jeans', shoes: 'sneakers', accessories: 'none' },
        personality: c.personality || ['determined'],
      }));
      if (extracted.length === 0) { toast.info('Nenhum personagem detectado.'); return; }
      setCharacters(extracted);
      persistCharacters(extracted);
      toast.success(`${extracted.length} personagens detectados e salvos!`);
    } catch (err: any) { toast.error(err.message || 'Erro ao detectar personagens'); }
    finally { setDetectingCharacters(false); }
  };

  return (
    <motion.div key="chars" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
      className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-accent" /> Personagens</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Defina personagens para consistência visual entre cenas</p>
        </div>
        <Button size="sm" onClick={() => setActiveStep('prompts')} className="gap-1 h-7 text-xs">
          Próximo <Image className="w-3 h-3" />
        </Button>
      </div>

      <Button onClick={autoDetectCharacters} disabled={detectingCharacters || !script} className="w-full gap-2 mb-2 gradient-hero border-0">
        {detectingCharacters ? <><Loader2 className="w-4 h-4 animate-spin" /> Detectando personagens...</>
          : <><Wand2 className="w-4 h-4" /> 🎭 Detectar Personagens do Roteiro</>}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center mb-4">As descrições serão injetadas automaticamente nos prompts visuais</p>

      {characters.length > 0 && (
        <div className="space-y-2 mb-4">
          {characters.map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{c.name} <span className="text-[10px] text-muted-foreground ml-1">({c.gender}, {c.age} anos)</span></p>
                <p className="text-[10px] text-muted-foreground">{c.role}</p>
                <p className="text-[10px] text-muted-foreground">👤 {c.appearance.skin_color} skin, {c.appearance.hair_color} {c.appearance.hair_style} hair, {c.appearance.eye_color} eyes, {c.appearance.height}</p>
                <p className="text-[10px] text-muted-foreground">👕 {c.clothing.shirt}, {c.clothing.pants}, {c.clothing.shoes}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeCharacter(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Nome *</label>
          <Input value={newCharName} onChange={e => setNewCharName(e.target.value)} placeholder="Ex: Narrador" className="bg-muted/30 h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Papel</label>
          <Input value={newCharDesc} onChange={e => setNewCharDesc(e.target.value)} placeholder="Protagonista" className="bg-muted/30 h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Aparência</label>
          <Input value={newCharAppearance} onChange={e => setNewCharAppearance(e.target.value)} placeholder="Homem 30 anos, cabelo curto" className="bg-muted/30 h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Roupa</label>
          <Input value={newCharClothing} onChange={e => setNewCharClothing(e.target.value)} placeholder="Terno azul escuro" className="bg-muted/30 h-8 text-xs" />
        </div>
      </div>
      <Button onClick={addCharacter} disabled={!newCharName.trim()} size="sm" variant="outline" className="mt-2 gap-1 text-xs">
        <Users className="w-3 h-3" /> Adicionar Manualmente
      </Button>
    </motion.div>
  );
};
