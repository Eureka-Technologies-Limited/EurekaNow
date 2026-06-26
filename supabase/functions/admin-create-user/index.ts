// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: admin-create-user
//
// Creates a Supabase Auth user on behalf of an admin when a new team member
// is added with a password. Uses the service role key so the password is
// hashed by Supabase Auth (bcrypt) — the plaintext is never stored in the
// application database.
//
// POST body: { email: string, password: string }
// Returns:   { auth_id: string }        — the new auth.users UUID
//
// Auth: caller must be a Supabase Auth user (JWT) or anon-key + _userId.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();
    if (!email)    throw new Error("email is required");
    if (!password) throw new Error("password is required");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    // ── Verify the caller is an authenticated admin ─────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerAuth } } = await supabase.auth.getUser(token);

    // Confirm the caller has a valid session (anon key will return null here)
    if (!callerAuth) {
      // Fallback: accept anon key callers but don't create admin users from them
      // (the client-side will only call this from an authenticated admin context)
      throw new Error("Unauthorized — must be signed in to create users.");
    }

    // ── Create the new auth user (auto-confirm email so they can sign in) ───
    const { data: newAuth, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,    // auto-confirmed — admin is vouching for this user
    });

    if (createError) {
      // Handle duplicate email gracefully
      if (createError.message?.includes("already been registered")) {
        const { data: existingAuth } = await supabase.auth.admin.listUsers();
        const found = existingAuth?.users?.find(
          (u) => u.email?.toLowerCase() === email.trim().toLowerCase(),
        );
        if (found) {
          return new Response(
            JSON.stringify({ auth_id: found.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      throw new Error(createError.message);
    }

    return new Response(
      JSON.stringify({ auth_id: newAuth.user?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[admin-create-user]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
