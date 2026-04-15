/**
 * Squad Runner Lite — Lightweight single-agent call for pre-generation enrichment.
 * Used by generate-script to run research/retention agents before streaming.
 */

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function callAIForSquad(
  googleKey: string,
  systemPrompt: string,
  userPrompt: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const maxTokens = opts?.maxTokens ?? 2048;
  const temp = opts?.temperature ?? 0.7;

  if (!googleKey) throw new Error("No API key for squad agent");

  const res = await fetch(`${GEMINI_URL}?key=${googleKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Squad agent error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
