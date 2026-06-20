import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase is not configured.\n\n" +
    "Add the following to your .env file:\n" +
    "  REACT_APP_SUPABASE_URL=https://<ref>.supabase.co\n" +
    "  REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>\n\n" +
    "Run supabase/schema.sql in your Supabase SQL Editor first."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
