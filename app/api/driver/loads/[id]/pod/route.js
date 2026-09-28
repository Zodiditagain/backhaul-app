import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Lets an assigned driver upload the signed BOL / proof-of-delivery photo
// straight from their phone. Uploaded through the service-role key rather
// than the browser talking to storage directly, since the "documents"
// bucket's own policies were written with trucker/broker uploads in mind,
// not drivers -- this route independently re-checks the same assignment +
// company ownership as the status-update route before touching storage.
export async function POST(req, { params }) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: driverProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, company_owner_id")
    .eq("id", user.id)
    .single();

  if (driverProfile?.role !== "driver" || !driverProfile.company_owner_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bolId = params.id;

  const { data: bol, error: bolError } = await supabaseAdmin
    .from("bols")
    .select("id, bol_number, match_id, broker_id, trucker_id, assigned_driver_id, status")
    .eq("id", bolId)
    .single();

  if (bolError || !bol) {
    return NextResponse.json({ error: "Load not found." }, { status: 404 });
  }

  if (bol.assigned_driver_id !== user.id || bol.trucker_id !== driverProfile.company_owner_id) {
    return NextResponse.json({ error: "This load isn't assigned to you." }, { status: 403 });
  }

  if (!["delivered", "receiver_signed", "completed"].includes(bol.status)) {
    return NextResponse.json({ error: "This load isn't at a stage where a POD can be uploaded yet." }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const ext = (file.name || "upload").split(".").pop();
  const path = `bols/${bolId}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("documents")
    .upload(path, Buffer.from(arrayBuffer), { contentType: file.type || undefined });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from("documents").getPublicUrl(path);
  const nowIso = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("bols")
    .update({
      pod_url: urlData.publicUrl,
      pod_uploaded_at: nowIso,
      pod_uploaded_by: user.id,
      updated_at: nowIso,
    })
    .eq("id", bolId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabaseAdmin.from("messages").insert({
    match_id: bol.match_id,
    sender_id: user.id,
    text: `📎 Signed BOL / POD uploaded for ${bol.bol_number}.`,
  });
  await supabaseAdmin.from("bol_audit_log").insert({
    bol_id: bolId,
    user_id: user.id,
    action: "pod_uploaded",
    details: file.name || null,
  });
  if (bol.broker_id) {
    await supabaseAdmin.from("notifications").insert({
      user_id: bol.broker_id,
      match_id: bol.match_id,
      bol_id: bolId,
      title: "Proof of delivery uploaded",
      message: `${bol.bol_number} — POD is now available.`,
    });
  }

  return NextResponse.json({ podUrl: urlData.publicUrl, podUploadedAt: nowIso });
}
