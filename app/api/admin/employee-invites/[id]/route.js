import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../lib/apiAuth";
import { logAuditEvent } from "../../../../../lib/auditLog";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Revokes a not-yet-used invite so its link stops working immediately —
// for a typo'd email, a hire that fell through, or just cleaning up.
// Already-used invites are left in place as a record of who signed up
// through them; deleting those would erase that history for no benefit,
// since a used token can't be replayed anyway.
export async function DELETE(req, { params }) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: invite } = await supabaseAdmin
    .from("employee_invites")
    .select("id, email, used_at")
    .eq("id", params.id)
    .single();

  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.used_at) {
    return NextResponse.json(
      { error: "This invite has already been used and can't be revoked." },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("employee_invites")
    .delete()
    .eq("id", params.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await logAuditEvent({
    actorId: user.id,
    actorRole: "admin",
    companyName: null,
    eventType: "admin",
    action: "Employee Invite Revoked",
    status: "success",
    metadata: { email: invite.email },
  });

  return NextResponse.json({ success: true });
}
