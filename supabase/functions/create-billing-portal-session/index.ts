// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: create-billing-portal-session
//
// Opens the Stripe Customer Portal so the user can manage/cancel/switch plan.
// Auto-creates a portal configuration if none exists (includes plan switching
// between Basic ↔ Pro with proration).
//
// POST body: { orgId: string, returnUrl: string }
// Returns:   { url: string }
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
    const { orgId, returnUrl, _userId } = await req.json();
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
      .select("id, stripe_customer_id, name")
      .eq("id", orgId)
      .single();

    if (orgError || !org) throw new Error("Organization not found");
    if (!org.stripe_customer_id) {
      throw new Error("No Stripe customer found for this organisation. Please subscribe to a plan first.");
    }

    // ── Create / find portal configuration ───────────────────────────────────
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
      httpClient: Stripe.createFetchHttpClient(),
    });

    let configurationId: string | undefined;
    const configs = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });

    if (configs.data.length > 0) {
      configurationId = configs.data[0].id;
    } else {
      // Auto-create a sensible default portal configuration
      const config = await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: "Manage your EurekaNow subscription",
          privacy_policy_url: "https://eurekanow.com/privacy",
          terms_of_service_url: "https://eurekanow.com/terms",
        },
        features: {
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_cancel: {
            enabled: true,
            mode: "at_period_end",
            cancellation_reason: {
              enabled: true,
              options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
            },
          },
          subscription_update: {
            enabled: true,
            default_allowed_updates: ["price"],
            proration_behavior: "create_prorations",
            products: [
              {
                product: "prod_UcpRaKrUXqLdFq", // EurekaNow Basic
                prices: ["price_1TdZmTJzWbyeb81A8OaC9A9S"],
              },
              {
                product: "prod_UcpSauVGoCkqhx", // EurekaNow Pro
                prices: ["price_1TdZnYJzWbyeb81AHZuDaTqf"],
              },
            ],
          },
        },
        default_return_url: returnUrl || "https://eurekanow.com",
      });
      configurationId = config.id;
      console.log("[create-billing-portal-session] Created portal configuration:", configurationId);
    }

    // ── Create portal session ─────────────────────────────────────────────────
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: returnUrl || "https://eurekanow.com",
      configuration: configurationId,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
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
