import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { getAuthedUser } from "../../../../lib/apiAuth";
import { logAuditEvent } from "../../../../lib/auditLog";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_LIFETIME_DAYS = 7;

async function requireAdmin(req) {
  const user = await getAuthedUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

// Lists every invite ever generated (pending, used, and expired) so the
// admin page can show history, not just the currently-active ones.
export async function GET(req) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;

  const { data, error: fetchError } = await supabaseAdmin
    .from("employee_invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ invites: data || [] });
}

// Generates a brand-new invite token for one specific hire's email address.
// Nothing gets emailed from here — this only creates the link. Sending it
// to the new hire (however you choose to — text, personal email, etc.) is
// still entirely up to you, on purpose.
export async function POST(req) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json();
  const email = String(body?.email || "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error: insertError } = await supabaseAdmin
    .from("employee_invites")
    .insert({
      token,
      email,
      created_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await logAuditEvent({
    actorId: user.id,
    actorRole: "admin",
    companyName: null,
    eventType: "admin",
    action: "Employee Invite Created",
    status: "success",
    metadata: { email },
  });

  return NextResponse.json({ invite: data });
}
