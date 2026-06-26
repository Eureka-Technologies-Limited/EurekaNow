-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260626_billing_owner
--
-- 1. Add owner_auth_id  — UUID pointing to the auth.users record of whoever
--    created the org. Only the owner can manage billing and plan changes.
-- 2. Add plan_start_date — anchor date for the billing cycle (set to org
--    creation date). Used to show "renews on the Nth of each month" in the UI.
-- 3. Fix plan default from 'Starter' → 'Free'.
-- 4. Backfill owner_auth_id for existing orgs.
--
-- Run this in Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add columns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_auth_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMPTZ DEFAULT NOW();

-- 2. Fix plan default + migrate existing "Starter" rows to "Free"
ALTER TABLE public.organizations ALTER COLUMN plan SET DEFAULT 'Free';
UPDATE public.organizations SET plan = 'Free' WHERE plan = 'Starter' OR plan IS NULL;

-- 3. Backfill plan_start_date from created_at where possible
UPDATE public.organizations
SET plan_start_date = created_at
WHERE plan_start_date IS NULL AND created_at IS NOT NULL;

-- 4. Backfill owner_auth_id — find the earliest Admin user per org
--    who has an auth_id (i.e. migrated to Supabase Auth).
UPDATE public.organizations o
SET owner_auth_id = sub.auth_id
FROM (
  SELECT DISTINCT ON (org_id)
    org_id,
    auth_id
  FROM public.users
  WHERE auth_id IS NOT NULL
    AND (role = 'Admin' OR roles::text ILIKE '%admin%')
  ORDER BY org_id, created_at ASC
) sub
WHERE sub.org_id = o.id
  AND o.owner_auth_id IS NULL;
