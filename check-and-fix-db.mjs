// ─────────────────────────────────────────────────────────────────────────────
// EurekaNow — DB setup checker & fixer
// Run from the EurekaNow project root:   node check-and-fix-db.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const OK  = "✅";
const ERR = "❌";
const WRN = "⚠️ ";

async function run() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║         EurekaNow — DB Setup Check & Fix             ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ── 1. Can we reach the DB at all? ─────────────────────────────────────────
  console.log("▶ 1/4  Connection check...");
  const { data: orgs, error: connErr } = await supabase
    .from("organizations")
    .select("id, name, plan, stripe_customer_id")
    .limit(5);

  if (connErr) {
    console.log(`  ${ERR} Cannot connect: ${connErr.message}`);
    console.log("     Check your SERVICE_ROLE_KEY and SUPABASE_URL.\n");
    process.exit(1);
  }
  console.log(`  ${OK}  Connected — found ${orgs.length} organization(s)`);
  orgs.forEach((o) =>
    console.log(`       • ${o.name} | plan=${o.plan} | stripe_customer_id=${o.stripe_customer_id || "null"}`)
  );

  // ── 2. Check stripe_customer_id column ─────────────────────────────────────
  console.log("\n▶ 2/4  Checking stripe_customer_id column...");

  // We already fetched it above — if no error, the column exists
  const firstOrg = orgs[0];
  const hasColumn = firstOrg !== undefined && "stripe_customer_id" in firstOrg;

  if (hasColumn) {
    console.log(`  ${OK}  stripe_customer_id column exists on organizations`);
  } else {
    console.log(`  ${WRN} Column missing — need to run migration`);
    console.log("\n  ──────────────────────────────────────────────────────");
    console.log("  Run this SQL in your Supabase SQL Editor:");
    console.log("  ──────────────────────────────────────────────────────");
    console.log(`
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
  CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id
    ON organizations (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;
`);
    console.log("  ──────────────────────────────────────────────────────\n");
  }

  // ── 3. Check organizations have a plan field ────────────────────────────────
  console.log("▶ 3/4  Checking plan field...");
  const { data: planRows, error: planErr } = await supabase
    .from("organizations")
    .select("id, name, plan")
    .limit(10);

  if (planErr) {
    console.log(`  ${ERR} Error reading plan: ${planErr.message}`);
  } else {
    const withPlan    = planRows.filter((r) => r.plan);
    const withoutPlan = planRows.filter((r) => !r.plan);
    console.log(`  ${OK}  plan column present`);
    if (withPlan.length)    console.log(`       ${withPlan.length} org(s) have a plan set: ${withPlan.map((r) => `${r.name}=${r.plan}`).join(", ")}`);
    if (withoutPlan.length) console.log(`       ${WRN} ${withoutPlan.length} org(s) have no plan (will default to Free in the app)`);
  }

  // ── 4. Verify edge function URLs are reachable (unauthenticated ping) ───────
  console.log("\n▶ 4/4  Pinging edge function endpoints...");
  const fns = [
    "create-checkout-session",
    "create-billing-portal-session",
    "get-billing-data",
    "stripe-webhook",
  ];

  for (const fn of fns) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "OPTIONS",
        headers: { "Content-Type": "application/json" },
      });
      // OPTIONS on an edge function returns 200 with CORS headers when deployed
      const deployed = res.status === 200 || res.status === 204 || res.status === 401;
      console.log(`  ${deployed ? OK : WRN} ${fn} → HTTP ${res.status}${deployed ? "" : " (may not be deployed yet)"}`);
    } catch (err) {
      console.log(`  ${ERR} ${fn} — network error: ${err.message}`);
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║                   Check complete                     ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  if (!hasColumn) {
    console.log("⚠️  ACTION REQUIRED: Run the migration SQL shown above in the Supabase SQL Editor.\n");
    process.exit(1);
  } else {
    console.log("🎉 Database looks good! Run the app and test the billing page.\n");
  }
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
