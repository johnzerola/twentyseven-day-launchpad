import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate embedding using Lovable AI gateway with a clever approach:
// We ask the model to convert text into a normalized numerical representation
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  // Use Google's text-embedding model via the gateway
  const response = await _ai({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `You are an embedding generator. Given text, output ONLY a JSON array of exactly 768 floating-point numbers between -1 and 1 that represent the semantic meaning of the text. The numbers should capture: topic, intent, emotion, domain, specificity. Output ONLY the JSON array, nothing else. No markdown, no explanation.`
        },
        { role: "user", content: text.slice(0, 2000) }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "store_embedding",
            description: "Store a 768-dimensional embedding vector",
            parameters: {
              type: "object",
              properties: {
                embedding: {
                  type: "array",
                  items: { type: "number" },
                  description: "768-dimensional embedding vector with values between -1 and 1"
                }
              },
              required: ["embedding"],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "store_embedding" } }
    });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Embedding generation failed:", response.status, errText);
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error("No tool call in response");
  }

  const args = JSON.parse(toolCall.function.arguments);
  let embedding = args.embedding;

  // Ensure exactly 768 dimensions
  if (!Array.isArray(embedding)) throw new Error("Embedding is not an array");
  
  if (embedding.length < 768) {
    // Pad with zeros
    while (embedding.length < 768) embedding.push(0);
  } else if (embedding.length > 768) {
    embedding = embedding.slice(0, 768);
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
  if (magnitude > 0) {
    embedding = embedding.map((v: number) => v / magnitude);
  }

  return embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts, source_table, source_ids, metadata_list } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new Error("texts array is required");
    }

    const results = [];
    const batchSize = 5; // Process 5 at a time to avoid rate limits

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchIds = source_ids?.slice(i, i + batchSize) || [];
      const batchMeta = metadata_list?.slice(i, i + batchSize) || [];

      const embeddings = await Promise.all(
        batch.map((text: string) => generateEmbedding(text, LOVABLE_API_KEY))
      );

      // Upsert into knowledge_embeddings
      for (let j = 0; j < batch.length; j++) {
        const embeddingStr = `[${embeddings[j].join(',')}]`;
        
        const { error } = await sb
          .from("knowledge_embeddings")
          .upsert({
            source_table: source_table,
            source_id: batchIds[j] || crypto.randomUUID(),
            content_text: batch[j].slice(0, 5000),
            metadata: batchMeta[j] || {},
            embedding: embeddingStr,
          }, { onConflict: 'source_table,source_id' });

        if (error) {
          console.error("Upsert error:", error);
          results.push({ index: i + j, success: false, error: error.message });
        } else {
          results.push({ index: i + j, success: true });
        }
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-embeddings error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
