

## Diagnosis

There are **two distinct problems**:

1. **The deployed edge function is STALE** — the response `"Rate limit. Aguarde e tente novamente."` does NOT exist in the current code. The previous deploy failed (bundle timeout), so an old version with an early 429 return is still running. The retry logic never actually executes.

2. **Google API quota is EXHAUSTED** — the logs show `RESOURCE_EXHAUSTED: You exceeded your current quota`. This is NOT a temporary rate limit — it means the daily/minute quota on your Google AI API key has been fully consumed. No amount of retrying will help until the quota resets.

3. **Multiple requests still fire simultaneously** — the network logs show 3 requests at the exact same second (03:26:12), meaning the sequential batch logic isn't preventing concurrent generation calls.

## Plan

### Step 1: Fix and redeploy the edge function
- Remove the `fetchWithRetry` with long waits (causes bundle timeout)
- Add a single simple retry (1 attempt, 10s wait) for 429s
- Return a clear error distinguishing quota exhaustion from temporary rate limits
- Include `Retry-After` info in the response

### Step 2: Fix frontend to truly enforce sequential requests
- In `runBatchVideos`, ensure `generateSegmentVideo` is fully awaited (including the initial API call completing) before moving to the next segment
- Increase delay between requests to 30 seconds
- Add a global "video generation in progress" lock to prevent the user from clicking individual "Vídeo" buttons or batch button while a batch is running
- On 429/quota error, stop the entire batch immediately instead of continuing

### Step 3: Better error UX
- Show a specific toast message when quota is exhausted: "Quota da API Google esgotada. Aguarde alguns minutos e tente novamente."
- Disable video generation buttons for 60 seconds after a quota error
- Show remaining cooldown time in the UI

### Step 4: Video preview (user's request)
- The `SegmentCard` already renders `<video>` tags when `videoSrc` exists — this works correctly once videos complete
- No changes needed for preview display — just need the generation to succeed

### Key insight for the user
The core blocker is **Google API quota exhaustion**. The code fixes will help prevent hitting the limit so aggressively, but you need to wait for the quota to reset (usually resets every minute or daily depending on your plan) before generating more videos.

