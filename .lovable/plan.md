

# Reescrita Completa do Motor de Masterização de Áudio

## Problema
O áudio remasterizado sai com chiados, ruídos e qualidade amadora. Os problemas principais identificados no código atual:

1. **Noise Gate fraco** — `floorGain: 0.08` ainda deixa 8% do ruído passar; o threshold adaptativo (`p20 * 2.2`) é muito conservador
2. **Air shelf amplifica ruído** — boost de +2dB acima de 10kHz amplifica hiss/chiado
3. **LPF muito alto** — 15kHz ainda permite frequências irritantes
4. **Normalização agressiva** — o gain pode chegar até 6x, amplificando qualquer ruído residual
5. **Compressor knee muito suave** (6dB) — não controla picos adequadamente
6. **Falta EQ para YouTube** — sem boost otimizado de graves/agudos para o codec do YouTube

## Plano de Implementação

### Arquivo: `src/lib/audioMastering.ts` — Reescrita completa

**1. Noise Gate mais agressivo**
- Reduzir `floorGain` de `0.08` para `0.01` (quase silêncio total nas pausas)
- Aumentar multiplicador do threshold de `2.2` para `3.0` para capturar mais ruído
- Aumentar release para 150ms para transições mais suaves

**2. Spectral Denoise adicional (novo)**
- Adicionar passo de subtração espectral simplificada após o noise gate
- Estimar perfil de ruído dos 10% mais silenciosos e subtrair do sinal inteiro
- Isso remove o "chiado constante" que o gate sozinho não resolve

**3. EQ otimizada para YouTube**
- HPF: manter 80Hz
- Body boost: aumentar para +3.5dB em 130Hz (mais grave/peso)
- Box cut: manter -3dB em 400Hz
- Presence: aumentar para +2.5dB em 2.8kHz (mais clareza/agudo)
- Air shelf: **reduzir para +1dB** em 10kHz (evitar chiado)
- LPF: **baixar para 12kHz** (corte mais agressivo de hiss)

**4. Compressor mais firme**
- Knee: reduzir de 6 para 3 (mais preciso)
- Threshold: -20dB (captura mais do sinal)
- Makeup gain automático após compressão

**5. De-esser reforçado**
- Primeiro band: -6dB em 7kHz (era -4dB)
- Segundo band: -4dB em 5.5kHz (era -2dB)
- Adicionar terceiro band: -3dB em 8.5kHz

**6. Normalização conservadora**
- Limitar gain máximo a 3x (era 6x) para nunca amplificar ruído
- Peak ceiling mais conservador: -2dB (era -3dB)
- Adicionar soft-clip antes da normalização final

**7. Defaults atualizados**
```text
noiseGateThresholdDb: -36  (era -40, mais agressivo)
airGainDb: 1.0             (era 2.0)
lpfFrequency: 12000        (era 15000)
bodyGainDb: 3.5             (era 2.5, mais grave)
presenceGainDb: 2.5         (era 1.5, mais agudo)
compressorKnee: 3           (era 6)
compressorThreshold: -20    (era -18)
```

### Resultado esperado
- Zero chiado/hiss no áudio final
- Voz com mais corpo (graves) e clareza (agudos) otimizada para YouTube
- Pausas completamente silenciosas
- Volume profissional (-14 LUFS) sem distorção

