import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Public on purpose (whoever has the link isn't logged in yet), but it
// only ever confirms/denies one specific token — it never lists or leaks
// any other invite. Used by the employee-signup page before it shows the
// actual form, so a dead link fails fast with a clear reason instead of
// someone filling out the whole form first.
export async function GET(req) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false, reason: "This link is missing an invite code." });
  }

  const { data: invite } = await supabaseAdmin
    .from("employee_invites")
    .select("email, expires_at, used_at")
    .eq("token", token)
    .single();

  if (!invite) {
    return NextResponse.json({
      valid: false,
      reason: "This invite link isn't valid. Ask your admin for a new one.",
    });
  }
  if (invite.used_at) {
    return NextResponse.json({
      valid: false,
      reason: "This invite link has already been used. Ask your admin for a new one.",
    });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({
      valid: false,
      reason: "This invite link has expired. Ask your admin to send a new one.",
    });
  }

  return NextResponse.json({ valid: true, email: invite.email });
}
