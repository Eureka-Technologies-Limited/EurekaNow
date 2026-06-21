// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: create-checkout-session
//
// Creates a Stripe Checkout session so an org can subscribe to Basic or Pro.
// If the org already has an active subscription, redirects to the portal instead.
//
// POST body: { orgId: string, priceId: string, returnUrl: string }
// Returns:   { url: string } — redirect the user here
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY  — sk_live_... or sk_test_...
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orgId, priceId, returnUrl, _userId } = await req.json();
    if (!orgId)    throw new Error("orgId is required");
    if (!priceId)  throw new Error("priceId is required");

    // ── Verify identity ───────────────────────────────────────────────────────
    // Two supported paths:
    //   1. Supabase Auth JWT  — Google OAuth users
    //   2. Custom auth        — email/password users; _userId verified via DB
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      // Custom auth path — verify _userId is a real admin of this org
      if (!_userId) throw new Error("Unauthorized");
      const { data: dbUser } = await supabase
        .from("users")
        .select("id, role, roles")
        .eq("id", _userId)
        .eq("org_id", orgId)
        .maybeSingle();
      if (!dbUser) throw new Error("Unauthorized");
      const roles = Array.isArray(dbUser.roles) ? dbUser.roles : [dbUser.role].filter(Boolean);
      const adminOk = roles.some((r: string) => String(r).toLowerCase() === "admin");
      if (!adminOk) throw new Error("Admin access required for billing");
    }

    // ── Fetch org ─────────────────────────────────────────────────────────────
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", orgId)
      .single();

    if (orgError || !org) throw new Error("Organization not found");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ── Ensure Stripe customer exists ─────────────────────────────────────────
    let customerId = org.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { orgId: org.id },
      });
      customerId = customer.id;

      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", orgId);

      console.log(`[create-checkout-session] Created Stripe customer ${customerId} for org ${orgId}`);
    }

    // ── Check for existing active subscription ────────────────────────────────
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (existingSubs.data.length > 0) {
      // Already subscribed — send to portal to switch plan
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || "https://eurekanow.com",
      });
      return new Response(
        JSON.stringify({ url: portal.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Create Checkout session ───────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}${returnUrl?.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl || "https://eurekanow.com",
      metadata: { orgId },
      subscription_data: { metadata: { orgId } },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
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
