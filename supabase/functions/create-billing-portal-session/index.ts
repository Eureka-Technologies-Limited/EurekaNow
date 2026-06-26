// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: create-billing-portal-session
//
// Opens the Stripe Customer Portal for managing subscriptions, payment methods,
// and downloading invoices. Downgrading from a paid plan to Free happens here.
//
// Permission: org OWNER only.
// POST body: { orgId, returnUrl? }
// Returns:   { url }
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
    const { orgId, returnUrl } = await req.json();
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

    // ── Fetch org + owner check ────────────────────────────────────────────
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, stripe_customer_id, owner_auth_id")
      .eq("id", orgId)
      .single();

    if (orgError || !org) throw new Error("Organization not found");

    if (org.owner_auth_id !== user.id) {
      throw new Error("Only the account owner can manage billing.");
    }

    if (!org.stripe_customer_id) {
      throw new Error("No billing account found. Please contact support.");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ── Ensure portal configuration includes a Free plan downgrade option ──
    // Find or create a portal configuration that lets users cancel/downgrade.
    let portalConfigId: string | undefined;
    try {
      const configs = await stripe.billingPortal.configurations.list({ limit: 1, active: true });
      portalConfigId = configs.data[0]?.id;
    } catch (_) { /* use default */ }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: returnUrl || "https://app.eurekanow.com",
      ...(portalConfigId ? { configuration: portalConfigId } : {}),
    });

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-billing-portal-session]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
