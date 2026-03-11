/**
 * Retry utility with exponential backoff for edge function calls.
 * Use this wrapper around supabase.functions.invoke() calls.
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: number[]; // HTTP status codes to retry on
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryOn: [429, 500, 502, 503, 504],
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wraps a fetch/invoke call with exponential backoff retry logic.
 * Returns the successful result or throws after all retries exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.code;
      
      // Don't retry on client errors (except rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }

      if (attempt < opts.maxRetries) {
        const delay = Math.min(
          opts.baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
          opts.maxDelayMs
        );
        console.warn(`Retry ${attempt + 1}/${opts.maxRetries} after ${Math.round(delay)}ms:`, err?.message);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All retries exhausted');
}

/**
 * Debounce helper — returns a debounced version of a function.
 * Prevents rapid-fire AI calls from the UI.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

/**
 * Throttle helper — ensures a function runs at most once per interval.
 * Use on "Generate" buttons to prevent cost explosion.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  intervalMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= intervalMs) {
      lastCall = now;
      fn(...args);
    }
  };
}
