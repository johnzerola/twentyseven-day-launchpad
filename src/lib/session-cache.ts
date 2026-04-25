import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Per-page session cache.
 *
 * Goal: avoid concurrent `supabase.auth.getSession()` / `getUser()` calls
 * which trigger noisy "navigator lock stolen" warnings when multiple
 * components mount in parallel and each query the auth state.
 *
 * Strategy:
 *  - Coalesce concurrent callers onto a single in-flight Promise.
 *  - Cache the resolved session for a short TTL (default 5s) so a burst
 *    of mounts during the same render cycle reuses the same value.
 *  - Listen to `onAuthStateChange` and invalidate the cache so logout /
 *    token refresh are reflected immediately.
 *  - Expose `invalidateSessionCache()` for callers that mutate auth.
 */

let cached: { session: Session | null; at: number } | null = null;
let inflight: Promise<Session | null> | null = null;
const TTL_MS = 5_000;

// Invalidate cache on any auth state change so we never serve stale data.
supabase.auth.onAuthStateChange((_event, session) => {
  cached = { session: session ?? null, at: Date.now() };
  inflight = null;
});

export function invalidateSessionCache() {
  cached = null;
  inflight = null;
}

export async function getCachedSession(): Promise<Session | null> {
  // Fresh cache hit
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.session;
  }

  // Coalesce concurrent callers
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      cached = { session: data.session ?? null, at: Date.now() };
      return cached.session;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Convenience: returns the user object or null. */
export async function getCachedUser() {
  const s = await getCachedSession();
  return s?.user ?? null;
}
