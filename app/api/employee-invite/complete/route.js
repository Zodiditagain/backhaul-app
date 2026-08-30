import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "../../../../lib/auditLog";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Called right after the employee-signup page's own supabase.auth.signUp()
// call succeeds (that's what actually creates the auth account — this
// route never sees or handles the password). This is the one place that
// actually turns that new account into an admin, and it does that itself
// via the service-role key rather than trusting anything the browser
// claims about itself — the invite token is checked fresh here, and the
// account's real email is looked up independently through Supabase Auth
// rather than trusted from the request body.
export async function POST(req) {
  const body = await req.json();
  const token = String(body?.token || "");
  const userId = String(body?.userId || "");

  if (!token || !userId) {
    return NextResponse.json({ error: "Missing invite token or user id." }, { status: 400 });
  }

  const { data: invite } = await supabaseAdmin
    .from("employee_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (!invite) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 400 });
  }
  if (invite.used_at) {
    return NextResponse.json({ error: "This invite link has already been used." }, { status: 400 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite link has expired." }, { status: 400 });
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authError || !authUser?.user) {
    return NextResponse.json({ error: "Couldn't verify the new account." }, { status: 400 });
  }

  const actualEmail = String(authUser.user.email || "").trim().toLowerCase();
  if (actualEmail !== invite.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "This invite was issued for a different email address." },
      { status: 400 }
    );
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    role: "admin",
    company_name: "Backhaul",
    is_admin: true,
    onboarding_completed: true,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await supabaseAdmin
    .from("employee_invites")
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq("id", invite.id);

  await logAuditEvent({
    actorId: userId,
    actorRole: "admin",
    companyName: "Backhaul",
    eventType: "admin",
    action: "Employee Account Created",
    status: "success",
    metadata: { email: actualEmail },
  });

  return NextResponse.json({ success: true });
}
