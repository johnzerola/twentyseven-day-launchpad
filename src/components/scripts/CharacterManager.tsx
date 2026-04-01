import { useState, useEffect, useRef } from 'react';
import { Users, Trash2, Loader2, Wand2, Image, Upload, Star, StarOff, Download, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import type { Character, VideoStyleOption } from './types';

interface GlobalChar {
  id: string;
  name: string;
  role: string;
  gender: string;
  age: number;
  photo_url: string | null;
  visual_description: string | null;
  appearance: any;
  facial_features: any;
  clothing: any;
  personality: string[];
  is_main_character: boolean;
  usage_count: number;
}

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
  const [globalChars, setGlobalChars] = useState<GlobalChar[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [showGlobalLibrary, setShowGlobalLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadCharIdx, setPendingUploadCharIdx] = useState<number | null>(null);

  // Load global characters
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingGlobal(false); return; }
      const { data } = await supabase
        .from('global_characters' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('is_main_character', { ascending: false });
      setGlobalChars((data as any) || []);
      setLoadingGlobal(false);
    };
    load();
  }, []);

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
        reference_image_url: (c as any).photo_url || null,
        visual_attributes: {
          gender: c.gender, age: c.age, role: c.role,
          appearance: c.appearance, facial_features: c.facial_features,
          clothing: c.clothing, personality: c.personality,
        },
      }));
      await supabase.from('characters').insert(rows as any);
    } catch (err: any) { console.error('Failed to persist characters:', err); }
  };

  // Upload photo to storage
  const handlePhotoUpload = async (file: File, charIndex: number) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 5MB)');
      return;
    }

    setUploadingPhoto(characters[charIndex]?.name || 'uploading');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop() || 'png';
      const path = `characters/${user.id}/${Date.now()}_${characters[charIndex].name.replace(/\s+/g, '_')}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      // Update character in current session
      const updated = [...characters];
      (updated[charIndex] as any).photo_url = photoUrl;
      setCharacters(updated);
      persistCharacters(updated);

      // Also save/update in global_characters
      await saveToGlobal(updated[charIndex], photoUrl);

      toast.success(`Foto de ${characters[charIndex].name} salva!`);
    } catch (e: any) {
      toast.error('Erro ao fazer upload: ' + e.message);
    } finally {
      setUploadingPhoto(null);
      setPendingUploadCharIdx(null);
    }
  };

  const saveToGlobal = async (char: Character, photoUrl?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = globalChars.find(g => g.name.toLowerCase() === char.name.toLowerCase());
    const globalData: any = {
      user_id: user.id,
      name: char.name,
      role: char.role,
      gender: char.gender,
      age: char.age,
      appearance: char.appearance,
      facial_features: char.facial_features,
      clothing: char.clothing,
      personality: char.personality,
      visual_description: buildCharImagePrompt(char),
      updated_at: new Date().toISOString(),
    };
    if (photoUrl) globalData.photo_url = photoUrl;

    if (existing) {
      await supabase.from('global_characters' as any)
        .update(globalData)
        .eq('id', existing.id);
      setGlobalChars(prev => prev.map(g => g.id === existing.id ? { ...g, ...globalData } : g));
    } else {
      const { data } = await supabase.from('global_characters' as any)
        .insert(globalData)
        .select()
        .single();
      if (data) setGlobalChars(prev => [...prev, data as any]);
    }
  };

  const importFromGlobal = (gc: GlobalChar) => {
    const char: Character = {
      name: gc.name,
      gender: gc.gender || 'male',
      age: gc.age || 30,
      role: gc.role || 'Personagem',
      appearance: gc.appearance || { skin_color: 'light tan', hair_color: 'dark brown', hair_style: 'short', eye_color: 'brown', body_type: 'average', height: '1.75m' },
      facial_features: gc.facial_features || { eyebrows: 'medium arched', nose: 'straight medium', mouth: 'medium lips', ears: 'normal size', face_shape: 'oval' },
      clothing: gc.clothing || { shirt: 'casual t-shirt', pants: 'dark jeans', shoes: 'sneakers', accessories: 'none' },
      personality: gc.personality || ['determined'],
    };
    (char as any).photo_url = gc.photo_url;

    // Don't add duplicates
    if (characters.find(c => c.name.toLowerCase() === gc.name.toLowerCase())) {
      toast.info(`${gc.name} já está neste projeto`);
      return;
    }

    const updated = [...characters, char];
    setCharacters(updated);
    persistCharacters(updated);

    // Increment usage
    supabase.from('global_characters' as any)
      .update({ usage_count: (gc.usage_count || 0) + 1 } as any)
      .eq('id', gc.id)
      .then(() => {});

    toast.success(`${gc.name} importado!`);
  };

  const toggleMainCharacter = async (gc: GlobalChar) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Unset all others first
    if (!gc.is_main_character) {
      await supabase.from('global_characters' as any)
        .update({ is_main_character: false } as any)
        .eq('user_id', user.id);
    }
    await supabase.from('global_characters' as any)
      .update({ is_main_character: !gc.is_main_character } as any)
      .eq('id', gc.id);
    setGlobalChars(prev => prev.map(g => ({
      ...g,
      is_main_character: g.id === gc.id ? !gc.is_main_character : false,
    })));
  };

  const deleteGlobalChar = async (gc: GlobalChar) => {
    await supabase.from('global_characters' as any).delete().eq('id', gc.id);
    setGlobalChars(prev => prev.filter(g => g.id !== gc.id));
    toast.success(`${gc.name} removido da biblioteca`);
  };

  const addCharacter = () => {
    if (!newCharName.trim()) return;
    const newChar: Character = {
      name: newCharName.trim(), gender: 'male', age: 30,
      role: newCharDesc.trim() || 'Personagem',
      appearance: {
        skin_color: 'light tan', hair_color: 'dark brown', hair_style: 'short',
        eye_color: 'brown', body_type: 'average', height: '1.75m',
      },
      facial_features: { eyebrows: 'medium arched', nose: 'straight medium', mouth: 'medium lips', ears: 'normal size', face_shape: 'oval' },
      clothing: { shirt: newCharClothing.trim() || 'casual t-shirt', pants: 'dark jeans', shoes: 'sneakers', accessories: 'none' },
      personality: ['determined', 'curious'],
    };
    const updated = [...characters, newChar];
    setCharacters(updated);
    persistCharacters(updated);
    saveToGlobal(newChar);
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
      const extracted: Character[] = (data.characters || []).map((c: any) => {
        // Check if this character exists in global library
        const globalMatch = globalChars.find(g => g.name.toLowerCase() === c.name?.toLowerCase());
        if (globalMatch) {
          // Use global attributes for consistency!
          return {
            name: globalMatch.name,
            gender: globalMatch.gender || c.gender || 'male',
            age: globalMatch.age || c.age || 30,
            role: globalMatch.role || c.role || 'Personagem',
            appearance: globalMatch.appearance || c.appearance || { skin_color: 'light', hair_color: 'dark', hair_style: 'short', eye_color: 'brown', body_type: 'average', height: '1.75m' },
            facial_features: globalMatch.facial_features || c.facial_features || { eyebrows: 'medium', nose: 'straight', mouth: 'medium', ears: 'normal', face_shape: 'oval' },
            clothing: globalMatch.clothing || c.clothing || { shirt: 'casual shirt', pants: 'jeans', shoes: 'sneakers', accessories: 'none' },
            personality: globalMatch.personality || c.personality || ['determined'],
            photo_url: globalMatch.photo_url,
          } as any;
        }
        return {
          name: c.name, gender: c.gender || 'male', age: c.age || 30,
          role: c.role || c.description || 'Personagem',
          appearance: c.appearance || { skin_color: 'light', hair_color: 'dark', hair_style: 'short', eye_color: 'brown', body_type: 'average', height: '1.75m' },
          facial_features: c.facial_features || { eyebrows: 'medium', nose: 'straight', mouth: 'medium', ears: 'normal', face_shape: 'oval' },
          clothing: c.clothing || { shirt: 'casual shirt', pants: 'jeans', shoes: 'sneakers', accessories: 'none' },
          personality: c.personality || ['determined'],
        };
      });
      if (extracted.length === 0) { toast.info('Nenhum personagem detectado.'); return; }
      setCharacters(extracted);
      persistCharacters(extracted);
      // Save new ones to global
      for (const ch of extracted) {
        if (!globalChars.find(g => g.name.toLowerCase() === ch.name.toLowerCase())) {
          await saveToGlobal(ch);
        }
      }
      toast.success(`${extracted.length} personagens detectados e salvos!`);
    } catch (err: any) { toast.error(err.message || 'Erro ao detectar personagens'); }
    finally { setDetectingCharacters(false); }
  };

  return (
    <motion.div key="chars" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
      className="bg-card border border-border rounded-xl p-5">
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && pendingUploadCharIdx !== null) {
            handlePhotoUpload(file, pendingUploadCharIdx);
          }
          e.target.value = '';
        }}
      />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-accent" /> Personagens</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Personagens persistem entre projetos — mesma identidade visual sempre</p>
        </div>
        <Button size="sm" onClick={() => setActiveStep('prompts')} className="gap-1 h-7 text-xs">
          Próximo <Image className="w-3 h-3" />
        </Button>
      </div>

      {/* Global Library Toggle */}
      {globalChars.length > 0 && (
        <div className="mb-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-2"
            onClick={() => setShowGlobalLibrary(!showGlobalLibrary)}
          >
            <Users className="w-3.5 h-3.5" />
            Minha Biblioteca ({globalChars.length} personagens)
            {globalChars.some(g => g.is_main_character) && (
              <Badge variant="outline" className="text-[9px] ml-1">⭐ Principal definido</Badge>
            )}
          </Button>

          <AnimatePresence>
            {showGlobalLibrary && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 mt-2 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <p className="text-[10px] text-muted-foreground font-medium">Clique para importar ao projeto atual:</p>
                  {globalChars.map((gc) => (
                    <div key={gc.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/30 hover:border-primary/30 transition-colors">
                      {gc.photo_url ? (
                        <img src={gc.photo_url} alt={gc.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                          {gc.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {gc.name}
                          {gc.is_main_character && <span className="ml-1 text-chart-4">⭐</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{gc.role} • {gc.usage_count}x usado</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => toggleMainCharacter(gc)}
                          title={gc.is_main_character ? 'Remover principal' : 'Definir como principal'}
                        >
                          {gc.is_main_character ? <Star className="w-3 h-3 text-chart-4 fill-chart-4" /> : <StarOff className="w-3 h-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => importFromGlobal(gc)}
                          title="Usar neste projeto"
                        >
                          <Download className="w-3 h-3 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                          onClick={() => deleteGlobalChar(gc)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <Button onClick={autoDetectCharacters} disabled={detectingCharacters || !script} className="w-full gap-2 mb-2 gradient-hero border-0">
        {detectingCharacters ? <><Loader2 className="w-4 h-4 animate-spin" /> Detectando personagens...</>
          : <><Wand2 className="w-4 h-4" /> 🎭 Detectar Personagens do Roteiro</>}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center mb-4">
        Personagens da sua biblioteca são reconhecidos automaticamente e mantêm a mesma identidade visual
      </p>

      {/* Current Project Characters */}
      {characters.length > 0 && (
        <div className="space-y-2 mb-4">
          {characters.map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              {/* Photo or Initial */}
              <div className="relative group shrink-0">
                {(c as any).photo_url ? (
                  <img src={(c as any).photo_url} alt={c.name} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-lg font-bold">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => {
                    setPendingUploadCharIdx(i);
                    fileInputRef.current?.click();
                  }}
                  className="absolute inset-0 bg-background/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  disabled={uploadingPhoto === c.name}
                >
                  {uploadingPhoto === c.name ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {c.name}
                  <span className="text-[10px] text-muted-foreground ml-1">({c.gender}, {c.age} anos)</span>
                  {globalChars.find(g => g.name.toLowerCase() === c.name.toLowerCase())?.is_main_character && (
                    <span className="ml-1 text-chart-4">⭐ Principal</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">{c.role}</p>
                <p className="text-[10px] text-muted-foreground">👤 {c.appearance.skin_color} skin, {c.appearance.hair_color} {c.appearance.hair_style} hair, {c.appearance.eye_color} eyes, {c.appearance.height}</p>
                <p className="text-[10px] text-muted-foreground">👕 {c.clothing.shirt}, {c.clothing.pants}, {c.clothing.shoes}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                  setPendingUploadCharIdx(i);
                  fileInputRef.current?.click();
                }} title="Upload foto">
                  <Upload className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeCharacter(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Character Form */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Nome *</label>
          <Input value={newCharName} onChange={e => setNewCharName(e.target.value)} placeholder="Ex: Neneco" className="bg-muted/30 h-8 text-xs" />
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
        <Users className="w-3 h-3" /> Adicionar e Salvar na Biblioteca
      </Button>
    </motion.div>
  );
};
