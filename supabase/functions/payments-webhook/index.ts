import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function getWebhookSecret(env: StripeEnv): string {
  const secret = env === 'sandbox'
    ? Deno.env.get('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : Deno.env.get('PAYMENTS_LIVE_WEBHOOK_SECRET');
  if (!secret) throw new Error(`Webhook secret not configured for ${env}`);
  return secret;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);
    const webhookSecret = getWebhookSecret(env);

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    switch (event.type) {
      case "subscription.created":
      case "subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        const priceId = sub.items.data[0]?.price?.id;
        const productId = sub.items.data[0]?.price?.product as string;
        const lookupKey = sub.items.data[0]?.price?.lookup_key;

        await supabase.from("subscriptions").upsert({
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer as string,
          user_id: userId,
          status: sub.status,
          price_id: lookupKey || priceId,
          product_id: productId,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          environment: env,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_subscription_id,environment" });

        // Sync tier to user_subscriptions
        const tierMap: Record<string, string> = {
          starter_monthly: 'starter', starter_yearly: 'starter',
          creator_pro_monthly: 'pro', creator_pro_yearly: 'pro',
          studio_monthly: 'studio', studio_yearly: 'studio',
        };
        const tier = tierMap[lookupKey || ''] || 'starter';
        const creditsMap: Record<string, number> = { starter: 100, pro: 300, studio: 500 };

        if (sub.status === 'active' || sub.status === 'trialing') {
          await supabase.from("user_subscriptions").update({
            tier,
            credits_remaining: creditsMap[tier] || 100,
            credits_monthly_limit: creditsMap[tier] || 100,
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);
        }
        break;
      }

      case "subscription.canceled": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        await supabase.from("subscriptions").update({
          status: "canceled",
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", sub.id).eq("environment", env);

        // Downgrade to starter after period ends
        if (!sub.cancel_at_period_end) {
          await supabase.from("user_subscriptions").update({
            tier: 'starter',
            credits_remaining: 100,
            credits_monthly_limit: 100,
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);
        }
        break;
      }

      case "transaction.completed":
      case "transaction.payment_failed":
        // Log for analytics
        console.log(`Payment event: ${event.type}`, event.data.object);
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: (error as any)?.message ?? "Unknown error" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
