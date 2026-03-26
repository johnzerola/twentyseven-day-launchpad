const CACHE_KEYS = {
  DOTTI_RESPONSES: 'offline_dotti_responses',
  RECENT_SCRIPTS: 'offline_recent_scripts',
  VIDEO_CONFIG: 'offline_video_config',
  CHANNEL_DNA: 'offline_channel_dna',
} as const;

const MAX_DOTTI = 20;
const MAX_SCRIPTS = 5;

export function cacheDottiResponse(question: string, response: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEYS.DOTTI_RESPONSES) || '[]');
    stored.unshift({ q: question.slice(0, 200), r: response.slice(0, 2000), t: Date.now() });
    localStorage.setItem(CACHE_KEYS.DOTTI_RESPONSES, JSON.stringify(stored.slice(0, MAX_DOTTI)));
  } catch {}
}

export function getCachedDottiResponses(): Array<{ q: string; r: string; t: number }> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEYS.DOTTI_RESPONSES) || '[]'); } catch { return []; }
}

export function cacheScript(script: { id: string; topic: string; content: string; style: string }) {
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEYS.RECENT_SCRIPTS) || '[]');
    stored.unshift({ ...script, t: Date.now() });
    localStorage.setItem(CACHE_KEYS.RECENT_SCRIPTS, JSON.stringify(stored.slice(0, MAX_SCRIPTS)));
  } catch {}
}

export function getCachedScripts(): Array<{ id: string; topic: string; content: string; style: string; t: number }> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEYS.RECENT_SCRIPTS) || '[]'); } catch { return []; }
}

export function cacheVideoConfig(config: { niche: string; style: string; language: string; duration: string }) {
  try { localStorage.setItem(CACHE_KEYS.VIDEO_CONFIG, JSON.stringify(config)); } catch {}
}

export function getCachedVideoConfig(): { niche: string; style: string; language: string; duration: string } | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEYS.VIDEO_CONFIG) || 'null'); } catch { return null; }
}

export function cacheChannelDNA(dna: any) {
  try { localStorage.setItem(CACHE_KEYS.CHANNEL_DNA, JSON.stringify({ ...dna, t: Date.now() })); } catch {}
}

export function getCachedChannelDNA(): any | null {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEYS.CHANNEL_DNA) || 'null');
    if (!data) return null;
    // Expire after 24h
    if (Date.now() - (data.t || 0) > 24 * 3600_000) return null;
    return data;
  } catch { return null; }
}
