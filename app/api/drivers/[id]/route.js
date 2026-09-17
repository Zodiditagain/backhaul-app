import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../lib/apiAuth";
import { logAuditEvent } from "../../../../lib/auditLog";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Permanently removes a driver's account — for someone who's left the
// company. This deletes their login entirely (not just a flag), so they
// can no longer sign in at all; relies on profiles.id referencing
// auth.users with "on delete cascade" to clean up their profile row too.
export async function DELETE(req, { params }) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, company_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "trucker") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: driver } = await supabaseAdmin
    .from("profiles")
    .select("id, driver_full_name, company_owner_id, role")
    .eq("id", params.id)
    .single();

  if (!driver || driver.role !== "driver" || driver.company_owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(params.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await logAuditEvent({
    actorId: user.id,
    actorRole: "trucker",
    companyName: profile.company_name,
    eventType: "driver",
    action: "Driver Account Removed",
    status: "success",
    metadata: { driverFullName: driver.driver_full_name },
  });

  return NextResponse.json({ success: true });
}
