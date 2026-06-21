// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: get-billing-data
//
// Returns the org's current Stripe subscription and invoice history.
// Returns { subscription: null, invoices: [] } gracefully if the org has no
// Stripe customer yet (i.e. they're on the Free plan).
//
// POST body: { orgId: string }
// Returns:   { subscription: Stripe.Subscription | null, invoices: Stripe.Invoice[] }
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
    const { orgId, _userId } = await req.json();
    if (!orgId) throw new Error("orgId is required");

    // ── Verify identity ───────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
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
      .select("id, stripe_customer_id")
      .eq("id", orgId)
      .single();

    if (orgError || !org) throw new Error("Organization not found");

    // No Stripe customer yet → return empty (Free plan, no invoices)
    if (!org.stripe_customer_id) {
      return new Response(
        JSON.stringify({ subscription: null, invoices: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ── Fetch subscription ────────────────────────────────────────────────────
    const subs = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: "all",
      limit: 1,
      expand: ["data.latest_invoice"],
    });

    const subscription = subs.data[0] || null;

    // ── Fetch invoices ────────────────────────────────────────────────────────
    const invoiceList = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      limit: 24,
    });

    return new Response(
      JSON.stringify({
        subscription,
        invoices: invoiceList.data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[get-billing-data]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
