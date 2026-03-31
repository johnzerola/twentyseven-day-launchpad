export interface EdgeFunctionErrorPayload {
  error?: string;
  message?: string;
}

export async function getEdgeFunctionErrorPayload(error: unknown): Promise<EdgeFunctionErrorPayload | null> {
  if (!error || typeof error !== 'object') return null;

  const response = 'context' in error ? (error as { context?: Response }).context : undefined;
  if (!response || typeof response.json !== 'function') return null;

  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}
