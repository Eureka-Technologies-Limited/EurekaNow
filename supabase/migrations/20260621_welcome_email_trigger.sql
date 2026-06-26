-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: welcome_email_trigger
-- Fires send-welcome-email edge function when a user confirms their email.
-- Requires pg_net extension (enabled by default on Supabase).
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure pg_net is available
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Function called by the trigger
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
  user_name TEXT;
BEGIN
  -- Only fire when email_confirmed_at transitions from NULL → a value
  IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build the edge function URL from project ref
  edge_url := current_setting('app.supabase_url', true)
    || '/functions/v1/send-welcome-email';

  -- Use service role key for the internal call
  service_key := current_setting('app.service_role_key', true);

  -- Pull display name from metadata if available
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Call the edge function via pg_net (non-blocking HTTP POST)
  PERFORM extensions.http_post(
    url      := edge_url,
    body     := json_build_object(
      'user_id', NEW.id::text,
      'email',   NEW.email,
      'name',    user_name
    )::text,
    headers  := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger on auth.users when email_confirmed_at is set
DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;

CREATE TRIGGER on_email_confirmed
  AFTER UPDATE OF email_confirmed_at
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_confirmed();

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: You must set these two Postgres settings so the function can
-- resolve the URLs at runtime. Run these once in the Supabase SQL editor:
--
--   ALTER DATABASE postgres
--     SET app.supabase_url = 'https://anhsumvnxmxosdjclfss.supabase.co';
--
--   ALTER DATABASE postgres
--     SET app.service_role_key = '<your service role key>';
--
-- The service role key is safe here — it never leaves your DB server.
-- ─────────────────────────────────────────────────────────────────────────────
