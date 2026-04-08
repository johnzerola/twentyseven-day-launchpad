import { useState, useMemo } from 'react';
import { DollarSign, Copy, ExternalLink, TrendingUp, Check, Zap, Clock, BadgeDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface AffiliateProgram {
  name: string;
  commission: string;
  approval: string;
  approvalDays: number;
  signupUrl: string;
  descriptionSnippet: string;
}

const NICHE_AFFILIATES: Record<string, AffiliateProgram[]> = {
  'finanças': [
    { name: 'Amazon Associates BR', commission: '4-8%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://associados.amazon.com.br', descriptionSnippet: 'Os livros e ferramentas que uso para investir:' },
    { name: 'Hotmart — Cursos Finanças', commission: '30-80%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://hotmart.com', descriptionSnippet: 'Aprenda finanças pessoais do zero:' },
    { name: 'Nubank Afiliados', commission: 'R$50/conta', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://nubank.com.br/indicacao', descriptionSnippet: 'Abra sua conta no Nubank e ganhe R$50:' },
    { name: 'Rico Investimentos', commission: 'R$30/cadastro', approval: '1-3 dias', approvalDays: 2, signupUrl: 'https://rico.com.vc', descriptionSnippet: 'Comece a investir com R$1:' },
    { name: 'Kinvo', commission: 'R$20/cadastro', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://kinvo.com.br', descriptionSnippet: 'Acompanhe seus investimentos em um só lugar:' },
  ],
  'tecnologia': [
    { name: 'Amazon Associates BR', commission: '4-8%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://associados.amazon.com.br', descriptionSnippet: 'Os gadgets e ferramentas que recomendo:' },
    { name: 'Hotmart — Cursos de IA', commission: '30-80%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://hotmart.com', descriptionSnippet: 'Domine IA com este curso completo:' },
    { name: 'HostGator Afiliados', commission: 'R$50-150/venda', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://hostgator.com.br/afiliados', descriptionSnippet: 'Crie seu site/blog com 60% de desconto:' },
    { name: 'ElevenLabs Affiliate', commission: '22% recorrente', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://elevenlabs.io/affiliate', descriptionSnippet: 'A IA de voz que uso nos meus vídeos:' },
    { name: 'Canva Pro Afiliados', commission: 'R$80/assinante', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://canva.com/affiliates', descriptionSnippet: 'Edite thumbnails como profissional:' },
  ],
  'saúde': [
    { name: 'Amazon Associates BR', commission: '4-8%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://associados.amazon.com.br', descriptionSnippet: 'Suplementos e equipamentos que uso:' },
    { name: 'iHerb', commission: '5-10%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://iherb.com/affiliate', descriptionSnippet: 'Suplementos importados com desconto:' },
    { name: 'Hotmart — Cursos Saúde', commission: '30-80%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://hotmart.com', descriptionSnippet: 'Transforme sua saúde com este programa:' },
    { name: 'Shopee Afiliados', commission: '5-15%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://shopee.com.br/affiliate', descriptionSnippet: 'Produtos de saúde com frete grátis:' },
    { name: 'GNC Brasil Afiliados', commission: '8%', approval: '1-3 dias', approvalDays: 2, signupUrl: 'https://gnc.com.br', descriptionSnippet: 'Whey e suplementos premium:' },
  ],
  'terror': [
    { name: 'Amazon Associates — Livros', commission: '4-8%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://associados.amazon.com.br', descriptionSnippet: 'Os livros de terror que inspiraram este vídeo:' },
    { name: 'Audible Afiliados', commission: 'R$15/trial', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://audible.com/affiliate', descriptionSnippet: 'Ouça audiobooks de terror grátis por 30 dias:' },
    { name: 'Amazon Prime Video', commission: 'R$10/assinatura', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://associados.amazon.com.br', descriptionSnippet: 'Assista os filmes mencionados no vídeo:' },
    { name: 'Hotmart — Cursos Roteiro', commission: '30-80%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://hotmart.com', descriptionSnippet: 'Aprenda a escrever histórias que arrepiam:' },
  ],
  'educação': [
    { name: 'Amazon Associates — Livros', commission: '4-8%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://associados.amazon.com.br', descriptionSnippet: 'Livros recomendados sobre o tema:' },
    { name: 'Audible Afiliados', commission: 'R$15/trial', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://hotmart.com', descriptionSnippet: 'Ouça livros enquanto se exercita:' },
    { name: 'Hotmart — Cursos', commission: '30-80%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://hotmart.com', descriptionSnippet: 'Aprofunde seu conhecimento:' },
    { name: 'Udemy Afiliados', commission: '15-45%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://udemy.com/affiliate', descriptionSnippet: 'Cursos online com certificado:' },
  ],
  'gaming': [
    { name: 'Amazon Associates — Games', commission: '4-8%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://associados.amazon.com.br', descriptionSnippet: 'Os periféricos e jogos que uso:' },
    { name: 'Nuuvem Afiliados', commission: '5-8%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://nuuvem.com', descriptionSnippet: 'Jogos com desconto e em português:' },
    { name: 'Green Man Gaming', commission: '5%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://greenmangaming.com/affiliates', descriptionSnippet: 'Keys de jogos com até 80% off:' },
    { name: 'Hotmart — Cursos Gaming', commission: '30-80%', approval: 'Instantâneo', approvalDays: 0, signupUrl: 'https://hotmart.com', descriptionSnippet: 'Aprenda a fazer stream profissional:' },
  ],
};

const NICHE_KEYWORDS: Record<string, string[]> = {
  'finanças': ['finanças', 'investimento', 'dinheiro', 'renda', 'cripto', 'bitcoin', 'trading', 'bolsa', 'ações', 'economia', 'poupança'],
  'tecnologia': ['tecnologia', 'tech', 'ia', 'inteligência artificial', 'programação', 'código', 'software', 'gadget', 'app', 'computador'],
  'saúde': ['saúde', 'fitness', 'academia', 'treino', 'dieta', 'nutrição', 'suplemento', 'emagrecer', 'bem-estar', 'exercício'],
  'terror': ['terror', 'horror', 'crime', 'true crime', 'mistério', 'assombração', 'serial killer', 'sobrenatural', 'creepypasta'],
  'educação': ['educação', 'história', 'ciência', 'curiosidade', 'filosofia', 'psicologia', 'estoicismo', 'aprender', 'documentário'],
  'gaming': ['gaming', 'game', 'jogo', 'gamer', 'play', 'minecraft', 'fortnite', 'fps', 'rpg', 'stream', 'twitch'],
};

function detectNiche(topic: string, niche: string): string {
  const text = `${topic} ${niche}`.toLowerCase();
  let bestMatch = 'educação';
  let bestScore = 0;
  for (const [key, keywords] of Object.entries(NICHE_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) { bestScore = score; bestMatch = key; }
  }
  return bestMatch;
}

interface Props {
  topic: string;
  niche: string;
  estimatedViews?: number;
}

export const AffiliateLinksGenerator = ({ topic, niche, estimatedViews = 1000 }: Props) => {
  const [selectedPrograms, setSelectedPrograms] = useState<Set<number>>(new Set());
  const [views, setViews] = useState(estimatedViews);

  const detectedNiche = useMemo(() => detectNiche(topic, niche), [topic, niche]);
  const affiliates = NICHE_AFFILIATES[detectedNiche] || NICHE_AFFILIATES['educação'];

  const toggleProgram = (index: number) => {
    setSelectedPrograms(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const estimatedRevenue = useMemo(() => {
    const conversionRate = 0.005;
    const avgCommission = 35;
    return Math.round(views * conversionRate * avgCommission / 100 * selectedPrograms.size || 0);
  }, [views, selectedPrograms.size]);

  const generateDescription = () => {
    const selected = Array.from(selectedPrograms).map(i => affiliates[i]).filter(Boolean);
    if (!selected.length) { toast.error('Selecione pelo menos um programa'); return; }
    const lines = ['🔗 LINKS MENCIONADOS NO VÍDEO:', ''];
    selected.forEach(p => {
      lines.push(`→ ${p.name}: [SEU LINK AQUI]`);
      lines.push(`  ${p.descriptionSnippet}`);
      lines.push(`  (link de afiliado — você ajuda o canal sem pagar nada a mais)`);
      lines.push('');
    });
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Descrição copiada! Cole na descrição do seu vídeo no YouTube.');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-chart-2" /> 💰 Monetizar Agora
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Nicho detectado: <Badge variant="outline" className="text-[9px] ml-1">{detectedNiche}</Badge> — Receita desde o vídeo 1, zero requisitos
          </p>
        </div>
      </div>

      {/* Revenue estimator */}
      <div className="bg-chart-2/10 border border-chart-2/20 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-chart-2" />
            <span className="text-xs font-medium">Views estimadas:</span>
            <Input
              type="number" value={views} onChange={e => setViews(Number(e.target.value))}
              className="w-24 h-7 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <BadgeDollarSign className="w-4 h-4 text-chart-2" />
            <span className="text-sm font-bold text-chart-2">
              R${estimatedRevenue > 0 ? estimatedRevenue : '—'}
            </span>
            <span className="text-[10px] text-muted-foreground">esta semana (0.5% conversão)</span>
          </div>
        </div>
      </div>

      {/* Affiliate programs */}
      <AnimatePresence>
        {affiliates.map((program, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`border rounded-xl p-4 cursor-pointer transition-all ${
              selectedPrograms.has(i) ? 'border-chart-2/50 bg-chart-2/5' : 'border-border hover:border-chart-2/30'
            }`}
            onClick={() => toggleProgram(i)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedPrograms.has(i) ? 'bg-chart-2/20' : 'bg-muted'
                }`}>
                  {selectedPrograms.has(i) ? <Check className="w-4 h-4 text-chart-2" /> : <DollarSign className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">{program.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className="text-[9px] bg-chart-2/20 text-chart-2 border-chart-2/30">{program.commission}</Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {program.approval}
                    </span>
                  </div>
                </div>
              </div>
              <a href={program.signupUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1">
                  <ExternalLink className="w-3 h-3" /> Cadastrar
                </Button>
              </a>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 ml-11">
              "{program.descriptionSnippet} [SEU LINK]"
            </p>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Generate description */}
      <Button onClick={generateDescription} disabled={selectedPrograms.size === 0} className="w-full gap-2">
        <Copy className="w-4 h-4" /> Copiar Descrição com Links ({selectedPrograms.size} selecionados)
      </Button>

      <p className="text-[9px] text-muted-foreground text-center">
        💡 Dica: Canais com 300 views/vídeo e 1% de conversão em produto de R$47 = R$47 na semana 2. Sem precisar de nenhum inscrito.
      </p>
    </div>
  );
};
