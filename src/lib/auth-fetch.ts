import { getCachedSession } from '@/lib/session-cache';

/**
 * Returns proper auth headers for edge function calls.
 * Uses the user's session access_token (not the anon key) as Bearer,
 * so RLS policies based on auth.uid() work correctly.
 * Falls back to anon key if no session (public endpoints).
 *
 * Uses a per-page session cache to avoid concurrent getSession() calls
 * (which would otherwise trigger noisy "navigator lock stolen" warnings).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getCachedSession();
  const accessToken = session?.access_token;
  
  return {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Authorization': `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };
}

/**
 * Authenticated fetch to a Supabase edge function.
 * Automatically includes proper auth headers.
 */
export async function authFetch(fnName: string, body: any, options?: { stream?: boolean; maxRetries?: number }): Promise<Response> {
  const headers = await getAuthHeaders();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
  const maxRetries = options?.maxRetries ?? 2;

  let lastResp: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (resp.status === 402) throw new Error('Créditos insuficientes.');
    if (resp.status === 429) {
      if (attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt) + Math.random() * 1000, 15000);
        console.warn(`[authFetch] ${fnName} 429, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error('Servidor sobrecarregado. Aguarde alguns segundos e tente novamente.');
    }
    if (!resp.ok && !options?.stream) {
      if (resp.status >= 500 && attempt < maxRetries) {
        const delay = Math.min(1500 * Math.pow(2, attempt) + Math.random() * 500, 10000);
        console.warn(`[authFetch] ${fnName} ${resp.status}, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `Erro na função ${fnName}`);
    }
    return resp;
  }

  throw new Error(`Falha após ${maxRetries + 1} tentativas na função ${fnName}`);
}
