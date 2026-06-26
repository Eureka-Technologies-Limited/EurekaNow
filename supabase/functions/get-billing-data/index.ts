// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: get-billing-data
//
// Returns Stripe subscription + invoice history for an org.
// Also auto-creates a Stripe customer on first load so the org is ready to
// upgrade without a separate setup step.
//
// Permission: org OWNER only (owner_auth_id on the organizations row).
// Auth: Supabase Auth JWT required.
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
    const { orgId } = await req.json();
    if (!orgId) throw new Error("orgId is required");

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

    // ── Fetch org + verify caller is the owner ─────────────────────────────
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, plan, stripe_customer_id, owner_auth_id, plan_start_date")
      .eq("id", orgId)
      .single();

    if (orgError || !org) throw new Error("Organization not found");

    if (org.owner_auth_id !== user.id) {
      throw new Error("Only the account owner can access billing.");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ── Auto-create Stripe customer on first billing load ─────────────────
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
      console.log(`[get-billing-data] Created Stripe customer ${customerId} for org ${orgId}`);
    }

    // ── Fetch Stripe data ──────────────────────────────────────────────────
    const [subs, invoiceList] = await Promise.all([
      stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 1,
        expand: ["data.latest_invoice"],
      }),
      stripe.invoices.list({ customer: customerId, limit: 24 }),
    ]);

    return new Response(
      JSON.stringify({
        subscription: subs.data[0] || null,
        invoices: invoiceList.data,
        planStartDate: org.plan_start_date,
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
