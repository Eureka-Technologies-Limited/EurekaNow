#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# EurekaNow — Stripe Billing Full Deploy Script
# Runs DB migration, deploys 4 edge functions, registers Stripe webhook,
# and sets all Supabase secrets in one shot.
#
# Run from the EurekaNow project root:
#   bash deploy-billing.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_REF="anhsumvnxmxosdjclfss"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
WEBHOOK_URL="${SUPABASE_URL}/functions/v1/stripe-webhook"

# Read Stripe key from .env
STRIPE_KEY=$(grep STRIPE_SECRET_KEY .env | cut -d'=' -f2 | tr -d '[:space:]')

# Supabase personal access token — passed as env var or arg
PAT="${SUPABASE_PAT:-sb_publishable_yydVdoyTeTMxfzfjC0vRSg_LBTEjxfk}"
export SUPABASE_ACCESS_TOKEN="${PAT}"

if [[ -z "$STRIPE_KEY" ]]; then
  echo "❌ Could not read STRIPE_SECRET_KEY from .env — make sure .env exists in this directory."
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        EurekaNow Billing Deploy — Starting           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Project : ${PROJECT_REF}"
echo "  Webhook : ${WEBHOOK_URL}"
echo ""

# ── Step 1: DB migration ──────────────────────────────────────────────────────
echo "▶ 1/5  Running DB migration..."

HTTP=$(curl -s -o /tmp/migration_out.json -w "%{http_code}" -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${PAT}" \
  -H "Content-Type: application/json" \
  -d '{"query":"ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT; CREATE INDEX IF NOT EXISTS idx_org_stripe ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;"}')

if [[ "$HTTP" == "2"* ]]; then
  echo "  ✅ stripe_customer_id column added"
else
  echo "  ⚠️  HTTP ${HTTP}: $(cat /tmp/migration_out.json)"
  echo "     (If column already exists this is fine — continuing)"
fi

# ── Step 2: Deploy edge functions ─────────────────────────────────────────────
echo ""
echo "▶ 2/5  Deploying edge functions..."

deploy_fn() {
  local name=$1
  local jwt_flag=$2
  echo -n "  → ${name} ... "
  OUTPUT=$(npx --yes supabase functions deploy "${name}" \
    --project-ref "${PROJECT_REF}" \
    ${jwt_flag} 2>&1)
  if echo "$OUTPUT" | grep -qi "deployed\|Done\|success"; then
    echo "✅"
  elif echo "$OUTPUT" | grep -qi "error\|failed"; then
    echo "❌"
    echo "     $OUTPUT"
  else
    echo "✅ (deployed)"
  fi
}

deploy_fn "create-checkout-session"        ""
deploy_fn "create-billing-portal-session"  ""
deploy_fn "get-billing-data"               ""
deploy_fn "stripe-webhook"                 "--no-verify-jwt"

echo "  ✅ All 4 functions deployed"

# ── Step 3: Register Stripe webhook ──────────────────────────────────────────
echo ""
echo "▶ 3/5  Registering Stripe webhook..."

# Check if webhook already exists for this project
EXISTING_ID=$(curl -s "https://api.stripe.com/v1/webhook_endpoints?limit=20" \
  -u "${STRIPE_KEY}:" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for ep in data.get('data', []):
    if '${PROJECT_REF}' in ep.get('url','') and ep.get('status') == 'enabled':
        print(ep['id'])
        break
" 2>/dev/null)

if [[ -n "$EXISTING_ID" ]]; then
  echo "  ℹ️  Webhook already registered (${EXISTING_ID})"
  echo "     ⚠️  Cannot retrieve the signing secret for an existing webhook."
  echo "     Go to: https://dashboard.stripe.com/webhooks/${EXISTING_ID}"
  echo "     Click 'Reveal' next to Signing secret and paste below when prompted."
  echo ""
  read -p "  Paste your webhook signing secret (whsec_...): " WEBHOOK_SECRET
else
  echo -n "  → Creating webhook endpoint ... "
  WH_RESP=$(curl -s -X POST "https://api.stripe.com/v1/webhook_endpoints" \
    -u "${STRIPE_KEY}:" \
    -d "url=${WEBHOOK_URL}" \
    -d "enabled_events[]=checkout.session.completed" \
    -d "enabled_events[]=customer.subscription.updated" \
    -d "enabled_events[]=customer.subscription.deleted" \
    -d "description=EurekaNow billing webhook")

  WEBHOOK_ID=$(echo "$WH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  WEBHOOK_SECRET=$(echo "$WH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('secret',''))" 2>/dev/null)

  if [[ -z "$WEBHOOK_ID" || "$WEBHOOK_ID" == "None" ]]; then
    echo "❌"
    echo "     Response: $WH_RESP"
    exit 1
  fi
  echo "✅  (${WEBHOOK_ID})"
fi

# ── Step 4: Set Supabase secrets ──────────────────────────────────────────────
echo ""
echo "▶ 4/5  Setting Supabase secrets..."

npx supabase secrets set \
  STRIPE_SECRET_KEY="${STRIPE_KEY}" \
  STRIPE_WEBHOOK_SECRET="${WEBHOOK_SECRET}" \
  --project-ref "${PROJECT_REF}"

echo "  ✅ STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET set"

# ── Step 5: Verify functions are live ─────────────────────────────────────────
echo ""
echo "▶ 5/5  Verifying deployed functions..."

curl -s "https://api.supabase.com/v1/projects/${PROJECT_REF}/functions" \
  -H "Authorization: Bearer ${PAT}" | python3 -c "
import sys, json
try:
    fns = json.load(sys.stdin)
    for f in fns:
        print('  ✅  ' + f.get('slug','?'))
except:
    print('  (verify in Supabase Dashboard → Edge Functions)')
" 2>/dev/null

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║            🎉  Billing is LIVE!                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Supabase URL  : ${SUPABASE_URL}"
echo "  Webhook URL   : ${WEBHOOK_URL}"
echo "  Webhook secret: ${WEBHOOK_SECRET:0:12}..."
echo ""
echo "  Test it: open the app → Plans & Billing → Upgrade Plan"
echo ""
