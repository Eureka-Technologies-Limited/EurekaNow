// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: send-welcome-email
// Called by a DB trigger (via pg_net) when a user confirms their email.
// Sends a branded welcome email via Resend.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();

    // Accept either direct call (auth hook) or DB trigger payload
    const userId: string = body.user_id ?? body.record?.id;
    const email: string  = body.email   ?? body.record?.email;
    const name: string   = body.name    ?? body.record?.raw_user_meta_data?.full_name ?? "";

    if (!email) throw new Error("Missing email");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const FROM_EMAIL = Deno.env.get("EMAIL_FROM") ?? "noreply@eurekanow.com";
    const FROM_NAME  = Deno.env.get("EMAIL_FROM_NAME") ?? "EurekaNow";
    const APP_URL    = Deno.env.get("APP_URL") ?? "https://app.eurekanow.com";

    const displayName = name || email.split("@")[0];

    // Load the welcome email HTML template from inline string
    // (Supabase edge functions can't read local files at runtime)
    const html = buildWelcomeEmail(displayName, email, APP_URL);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [email],
        subject: `Welcome to EurekaNow, ${displayName}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend API error: ${err}`);
    }

    const data = await res.json();
    console.log("[send-welcome-email] Sent to", email, "id:", data.id);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-welcome-email]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─── Inline HTML template ──────────────────────────────────────────────────
function buildWelcomeEmail(name: string, email: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to EurekaNow</title>
  </head>
  <body style="margin:0;padding:40px 20px;background:#0b1a30;font-family:'DM Sans',Arial,sans-serif;color:#FFFFFF;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;margin:0 auto;">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:#1D3557;border:1px solid #37474F;border-bottom:none;border-radius:16px 16px 0 0;">
          <tr><td style="height:3px;background:#F57A55;border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:36px 48px 32px;">
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr>
              <td style="width:42px;height:42px;background:#F57A55;border-radius:10px;text-align:center;vertical-align:middle;">
                <span style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:700;color:#0b1a30;line-height:42px;display:block;">E</span>
              </td>
              <td style="padding-left:12px;vertical-align:middle;">
                <span style="font-family:'Playfair Display',Georgia,serif;font-size:21px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">Eureka<span style="color:#F57A55;">Now</span></span>
              </td>
            </tr></table>
            <p style="margin:0 0 28px;font-size:11px;color:#B0BEC5;letter-spacing:1px;">by <strong style="color:#B0BEC5;font-weight:500;">Eureka Technologies Limited</strong></p>
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#F57A55;">You're all set</p>
            <h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:32px;font-weight:700;line-height:1.2;color:#FFFFFF;">
              Welcome to EurekaNow,<br /><em style="font-style:italic;color:#F57A55;">${name}.</em>
            </h1>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:#0b1a30;border:1px solid #37474F;border-top:none;border-bottom:none;">
          <tr><td style="padding:40px 48px;">
            <p style="margin:0 0 18px;font-size:16px;font-weight:500;color:#FFFFFF;line-height:1.6;">Hi ${name},</p>
            <p style="margin:0 0 32px;font-size:15px;font-weight:300;color:#B0BEC5;line-height:1.8;">
              Your account is confirmed and ready to go. EurekaNow gives your team a smarter way to handle support — faster tickets, clearer priorities, and everything in one place.
            </p>

            <p style="margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#90A4AE;">Get started in 3 steps</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background:#1D3557;border:1px solid #37474F;border-radius:10px;margin-bottom:36px;">
              <tr><td style="padding:0 22px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="padding:18px 0;border-bottom:1px solid #37474F;vertical-align:top;" width="36">
                    <table cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="width:28px;height:28px;background:#F57A55;border-radius:50%;text-align:center;vertical-align:middle;">
                        <span style="font-size:13px;font-weight:700;color:#0b1a30;line-height:28px;display:block;">1</span>
                      </td>
                    </tr></table>
                  </td>
                  <td style="padding:18px 0 18px 14px;border-bottom:1px solid #37474F;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#FFFFFF;">Invite your team</p>
                    <p style="margin:0;font-size:13px;font-weight:300;color:#B0BEC5;line-height:1.6;">Add members from Settings → Team. They'll get their own login instantly.</p>
                  </td>
                </tr></table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="padding:18px 0;border-bottom:1px solid #37474F;vertical-align:top;" width="36">
                    <table cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="width:28px;height:28px;background:#F57A55;border-radius:50%;text-align:center;vertical-align:middle;">
                        <span style="font-size:13px;font-weight:700;color:#0b1a30;line-height:28px;display:block;">2</span>
                      </td>
                    </tr></table>
                  </td>
                  <td style="padding:18px 0 18px 14px;border-bottom:1px solid #37474F;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#FFFFFF;">Raise your first ticket</p>
                    <p style="margin:0;font-size:13px;font-weight:300;color:#B0BEC5;line-height:1.6;">Head to Tickets and create one — assign it, set a priority, and track it to resolution.</p>
                  </td>
                </tr></table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="padding:18px 0;vertical-align:top;" width="36">
                    <table cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="width:28px;height:28px;background:#F57A55;border-radius:50%;text-align:center;vertical-align:middle;">
                        <span style="font-size:13px;font-weight:700;color:#0b1a30;line-height:28px;display:block;">3</span>
                      </td>
                    </tr></table>
                  </td>
                  <td style="padding:18px 0 18px 14px;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#FFFFFF;">Explore your plan</p>
                    <p style="margin:0;font-size:13px;font-weight:300;color:#B0BEC5;line-height:1.6;">Check Billing to see your current plan and upgrade whenever your team grows.</p>
                  </td>
                </tr></table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;">
              <tr><td style="text-align:center;">
                <a href="${appUrl}"
                  style="display:inline-block;background:#F57A55;color:#FFFFFF;font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.3px;padding:16px 48px;border-radius:8px;text-decoration:none;">
                  Open EurekaNow →
                </a>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr><td style="height:1px;background:#37474F;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;">
              <tr>
                <td width="48%" style="vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="background:#1D3557;border:1px solid #37474F;border-radius:10px;">
                    <tr><td style="padding:20px 22px;">
                      <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#90A4AE;">Need help?</p>
                      <a href="mailto:support@eurekanow.com"
                        style="display:block;font-size:13px;font-weight:600;color:#F57A55;text-decoration:none;line-height:1.5;">support@eurekanow.com</a>
                      <p style="margin:6px 0 0;font-size:11px;color:#90A4AE;">1–2 business days</p>
                    </td></tr>
                  </table>
                </td>
                <td width="4%">&nbsp;</td>
                <td width="48%" style="vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="background:#1D3557;border:1px solid #37474F;border-radius:10px;">
                    <tr><td style="padding:20px 22px;">
                      <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#90A4AE;">Your account</p>
                      <p style="margin:0;font-size:13px;font-weight:600;color:#FFFFFF;line-height:1.5;word-break:break-all;">${email}</p>
                      <p style="margin:6px 0 0;font-size:11px;color:#90A4AE;">Change in account settings</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-left:3px solid #F57A55;padding:16px 22px;background:rgba(245,122,85,0.06);border-radius:0 8px 8px 0;">
                  <p style="margin:0 0 8px;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:15px;color:#B0BEC5;line-height:1.7;">
                    "Eureka — the moment everything clicks. We built EurekaNow so that moment happens more often, for more teams."
                  </p>
                  <p style="margin:0;font-size:12px;color:#90A4AE;">— The Eureka Technologies Team</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:#1D3557;border:1px solid #37474F;border-top:1px solid #37474F;border-radius:0 0 16px 16px;">
          <tr><td style="padding:28px 48px;text-align:center;">
            <p style="margin:0 0 6px;font-family:'Playfair Display',Georgia,serif;font-size:15px;color:#FFFFFF;letter-spacing:0.3px;">Eureka<span style="color:#F57A55;">Now</span></p>
            <p style="margin:0 0 20px;font-size:11px;color:#90A4AE;letter-spacing:0.5px;">by Eureka Technologies Limited</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;"><tr>
              <td style="padding:0 12px;"><a href="https://eurekanow.com" style="font-size:12px;color:#B0BEC5;text-decoration:none;">Website</a></td>
              <td style="padding:0 12px;"><a href="https://eurekanow.com/privacy" style="font-size:12px;color:#B0BEC5;text-decoration:none;">Privacy Policy</a></td>
              <td style="padding:0 12px;"><a href="mailto:support@eurekanow.com" style="font-size:12px;color:#B0BEC5;text-decoration:none;">Support</a></td>
            </tr></table>
            <p style="margin:0;font-size:11px;color:#90A4AE;line-height:1.7;">
              You're receiving this because you created a EurekaNow account.<br />
              © 2026 Eureka Technologies Limited. All rights reserved.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
