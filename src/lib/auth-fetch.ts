import { supabase } from '@/integrations/supabase/client';

/**
 * Returns proper auth headers for edge function calls.
 * Uses the user's session access_token (not the anon key) as Bearer,
 * so RLS policies based on auth.uid() work correctly.
 * Falls back to anon key if no session (public endpoints).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
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
export async function authFetch(fnName: string, body: any, options?: { stream?: boolean }): Promise<Response> {
  const headers = await getAuthHeaders();
  
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (resp.status === 402) throw new Error('Créditos insuficientes.');
  if (resp.status === 429) throw new Error('Rate limit. Aguarde e tente novamente.');
  if (!resp.ok && !options?.stream) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Erro na função ${fnName}`);
  }

  return resp;
}
