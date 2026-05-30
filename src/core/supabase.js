import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.info(
    "🎮 Demo Mode Active — Supabase not configured.\n\n" +
    "   Demo credentials: demo@eurekanow.local / demo123\n\n" +
    "   To connect a real database:\n" +
    "     1. Run supabase/schema.sql in your Supabase SQL Editor\n" +
    "     2. Copy your project URL and anon key from Project → Settings → API\n" +
    "     3. Add them to .env:\n" +
    "          REACT_APP_SUPABASE_URL=https://<ref>.supabase.co\n" +
    "          REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>"
  );
}

export const supabase = createClient(
  supabaseUrl     || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder_anon_key"
);
