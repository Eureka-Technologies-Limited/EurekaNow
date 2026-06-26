// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: create-checkout-session
//
// Creates a Stripe Checkout session for upgrading to Basic or Pro.
// If the org already has an active paid subscription, redirects to the portal.
//
// Permission: org OWNER only.
// POST body: { orgId, priceId, returnUrl }
// Returns:   { url } — redirect here
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { orgId, priceId, returnUrl } = await req.json();
    if (!orgId)   throw new Error("orgId is required");
    if (!priceId) throw new Error("priceId is required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Verify JWT ────────────────────────────────────────────────────────────
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // ── Fetch org + owner check ────────────────────────────────────────────
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, stripe_customer_id, owner_auth_id, plan_start_date")
      .eq("id", orgId)
      .single();

    if (orgError || !org) throw new Error("Organization not found");

    if (org.owner_auth_id !== user.id) {
      throw new Error("Only the account owner can manage billing.");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ── Ensure Stripe customer exists ─────────────────────────────────────
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        email: user.email,
        metadata: { orgId: org.id },
      });
      customerId = customer.id;
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", orgId);
    }

    // ── If already on a paid plan, redirect to portal instead ─────────────
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (existingSubs.data.length > 0) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || "https://app.eurekanow.com",
      });
      return new Response(
        JSON.stringify({ url: portal.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Create Checkout session ───────────────────────────────────────────
    // Use the org's plan_start_date as the billing cycle anchor so invoices
    // always fall on the same day of the month the org was created.
    const billingAnchor = org.plan_start_date
      ? Math.floor(new Date(org.plan_start_date).getTime() / 1000)
      : undefined;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}${returnUrl?.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl || "https://app.eurekanow.com",
      metadata: { orgId },
      subscription_data: {
        metadata: { orgId },
        ...(billingAnchor ? { billing_cycle_anchor: billingAnchor } : {}),
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      tax_id_collection: { enabled: true },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-checkout-session]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
