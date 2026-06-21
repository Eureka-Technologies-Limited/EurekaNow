// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: stripe-webhook
//
// Receives Stripe webhook events and keeps the organizations table in sync:
//   checkout.session.completed       → set stripe_customer_id + plan
//   customer.subscription.updated   → update plan
//   customer.subscription.deleted   → downgrade to Free
//
// ⚠️  JWT verification is DISABLED — Stripe signs requests with its own secret.
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY      — sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET  — whsec_... (from Stripe Dashboard → Webhooks)
//
// Webhook URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Required events:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

// Map Stripe price IDs → plan names
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TdZmTJzWbyeb81A8OaC9A9S": "Basic",
  "price_1TdZnYJzWbyeb81AHZuDaTqf": "Pro",
};

serve(async (req) => {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-04-10",
    httpClient: Stripe.createFetchHttpClient(),
  });

  // ── Verify Stripe signature ───────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return new Response(`Webhook signature invalid: ${err}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  console.log(`[stripe-webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {

      // ── New subscription via Checkout ───────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const orgId      = session.metadata?.orgId;
        const customerId = session.customer as string;
        const subId      = session.subscription as string;

        if (!orgId) {
          console.error("[stripe-webhook] checkout.session.completed — missing orgId in metadata");
          break;
        }

        // Retrieve subscription to get the price
        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0]?.price?.id;
        const plan    = (priceId && PRICE_TO_PLAN[priceId]) || "Basic";

        const { error } = await supabase
          .from("organizations")
          .update({ stripe_customer_id: customerId, plan })
          .eq("id", orgId);

        if (error) {
          console.error("[stripe-webhook] DB update failed (checkout):", error);
        } else {
          console.log(`[stripe-webhook] Org ${orgId} → plan=${plan}, customer=${customerId}`);
        }
        break;
      }

      // ── Subscription updated (plan switch, renewal, etc.) ───────────────────
      case "customer.subscription.updated": {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const priceId    = sub.items.data[0]?.price?.id;
        const plan       = (priceId && PRICE_TO_PLAN[priceId]) || null;

        if (!plan) {
          console.log(`[stripe-webhook] subscription.updated — unknown priceId: ${priceId}`);
          break;
        }

        // Lookup org by stripe_customer_id
        const { data: org, error: lookupErr } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (lookupErr || !org) {
          console.error("[stripe-webhook] Org not found for customer:", customerId, lookupErr);
          break;
        }

        const { error } = await supabase
          .from("organizations")
          .update({ plan })
          .eq("id", org.id);

        if (error) {
          console.error("[stripe-webhook] DB update failed (sub updated):", error);
        } else {
          console.log(`[stripe-webhook] Org ${org.id} plan updated → ${plan}`);
        }
        break;
      }

      // ── Subscription cancelled ──────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: org, error: lookupErr } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (lookupErr || !org) {
          console.error("[stripe-webhook] Org not found for customer:", customerId, lookupErr);
          break;
        }

        const { error } = await supabase
          .from("organizations")
          .update({ plan: "Free" })
          .eq("id", org.id);

        if (error) {
          console.error("[stripe-webhook] DB update failed (sub deleted):", error);
        } else {
          console.log(`[stripe-webhook] Org ${org.id} downgraded to Free (subscription deleted)`);
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[stripe-webhook] Handler error:", err);
    return new Response("Internal error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
