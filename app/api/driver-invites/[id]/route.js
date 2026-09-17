import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../lib/apiAuth";
import { logAuditEvent } from "../../../../lib/auditLog";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Revokes a not-yet-used invite so its link stops working immediately —
// for a typo'd email, a driver who never signed up, or just cleaning up.
// Scoped to invites this same company created, so one trucking company
// can never revoke (or even see) another's invite by guessing an id.
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

  const { data: invite } = await supabaseAdmin
    .from("driver_invites")
    .select("id, email, used_at, company_owner_id")
    .eq("id", params.id)
    .single();

  if (!invite || invite.company_owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.used_at) {
    return NextResponse.json(
      { error: "This invite has already been used and can't be revoked." },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("driver_invites")
    .delete()
    .eq("id", params.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await logAuditEvent({
    actorId: user.id,
    actorRole: "trucker",
    companyName: profile.company_name,
    eventType: "driver",
    action: "Driver Invite Revoked",
    status: "success",
    metadata: { email: invite.email },
  });

  return NextResponse.json({ success: true });
}
