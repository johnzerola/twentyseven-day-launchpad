import { useRef, useCallback, useState } from 'react';

/**
 * Hook that prevents rapid-fire calls on generation buttons.
 * Returns a wrapped function + busy state.
 * cooldownMs = minimum time between calls (default 3s).
 */
export function useDebouncedAction<T extends (...args: any[]) => Promise<any>>(
  action: T,
  cooldownMs: number = 3000
) {
  const lastCallRef = useRef(0);
  const [busy, setBusy] = useState(false);

  const wrappedAction = useCallback(async (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallRef.current < cooldownMs) {
      return; // silently ignore rapid clicks
    }
    lastCallRef.current = now;
    setBusy(true);
    try {
      return await action(...args);
    } finally {
      setBusy(false);
    }
  }, [action, cooldownMs]) as (...args: Parameters<T>) => Promise<ReturnType<T> | undefined>;

  return { execute: wrappedAction, busy };
}
