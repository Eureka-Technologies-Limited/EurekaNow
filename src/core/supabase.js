import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// eslint-disable-next-line no-console
console.info("🎮 Demo Mode Active: Using local data. Supabase not configured.\n\n📝 Demo Credentials:\n   Email: demo@eurekanow.local\n   Password: demo123\n\n✅ To enable real Supabase backend, set environment variables:\n   REACT_APP_SUPABASE_URL\n   REACT_APP_SUPABASE_ANON_KEY");

// Create a dummy client if not configured - will only be used if Supabase mode is enabled
// In demo mode, the api.js shouldUseDemoMode() will prevent any Supabase calls
const dummyUrl = "https://placeholder.supabase.co";
const dummyKey = "placeholder_anon_key";

export const supabase = createClient(
  supabaseUrl || dummyUrl,
  supabaseAnonKey || dummyKey
);
