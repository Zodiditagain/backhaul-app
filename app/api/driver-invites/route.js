import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { getAuthedUser } from "../../../lib/apiAuth";
import { logAuditEvent } from "../../../lib/auditLog";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_LIFETIME_DAYS = 7;

// Only a trucking company's own account can invite drivers under it —
// not brokers/vendors, and not a driver account itself (drivers can't
// invite other drivers).
async function requireTruckerOwner(req) {
  const user = await getAuthedUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, company_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "trucker") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, profile };
}

// Lists every invite this trucking company has ever generated (pending,
// used, and expired) so the Drivers page can show history, not just the
// currently-active ones.
export async function GET(req) {
  const { user, error } = await requireTruckerOwner(req);
  if (error) return error;

  const { data, error: fetchError } = await supabaseAdmin
    .from("driver_invites")
    .select("*")
    .eq("company_owner_id", user.id)
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ invites: data || [] });
}

// Generates a brand-new invite token for one specific driver's email
// address. Nothing gets emailed from here — this only creates the link.
// Sending it to the driver (text, personal email, whatever) is up to you.
export async function POST(req) {
  const { user, profile, error } = await requireTruckerOwner(req);
  if (error) return error;

  const body = await req.json();
  const email = String(body?.email || "").trim().toLowerCase();
  const driverFullName = String(body?.driverFullName || "").trim();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (!driverFullName) {
    return NextResponse.json({ error: "The driver's full name is required." }, { status: 400 });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error: insertError } = await supabaseAdmin
    .from("driver_invites")
    .insert({
      token,
      email,
      driver_full_name: driverFullName,
      company_owner_id: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await logAuditEvent({
    actorId: user.id,
    actorRole: "trucker",
    companyName: profile.company_name,
    eventType: "driver",
    action: "Driver Invite Created",
    status: "success",
    metadata: { email, driverFullName },
  });

  return NextResponse.json({ invite: data });
}
