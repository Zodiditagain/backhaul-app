import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// A driver only ever sees the loads their owner has explicitly assigned to
// them (bols.assigned_driver_id), and only a deliberately narrow set of
// fields -- no rate, no broker identity, no messages. Everything financial
// (rate_per_mile, freight_charges, declared_value, cod_amount) and anything
// broker-identifying is left out of the select below on purpose.
const DRIVER_SAFE_COLUMNS = [
  "id",
  "status",
  "bol_number",
  "load_number",
  "pickup_date",
  "delivery_date",
  "po_number",
  "reference_number",
  "shipper_name",
  "shipper_address",
  "shipper_city",
  "shipper_state",
  "shipper_zip",
  "shipper_contact",
  "shipper_phone",
  "pickup_instructions",
  "consignee_name",
  "consignee_address",
  "consignee_city",
  "consignee_state",
  "consignee_zip",
  "consignee_contact",
  "consignee_phone",
  "delivery_instructions",
  "equipment_type",
  "seal_number",
  "truck_number",
  "trailer_number",
  "driver_signature_name",
  "driver_signature_at",
  "shipper_signature_name",
  "pickup_condition",
  "pickup_pieces_count",
  "picked_up_at",
  "receiver_signature_name",
  "receiver_signature_at",
  "delivery_condition",
  "delivery_pieces_count",
  "delivered_at",
  "pod_url",
  "pod_uploaded_at",
  "updated_at",
  "created_at",
].join(", ");

// Only statuses a driver can actually see/act on -- draft, sent, and
// correction_requested are all pre-acceptance states that are still the
// broker/owner's back-and-forth, not something a driver should be shown.
const DRIVER_VISIBLE_STATUSES = [
  "accepted",
  "ready_for_pickup",
  "signed_at_pickup",
  "in_transit",
  "delivered",
  "receiver_signed",
  "completed",
];

export async function GET(req) {
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

  const { data, error: fetchError } = await supabaseAdmin
    .from("bols")
    .select(DRIVER_SAFE_COLUMNS)
    .eq("assigned_driver_id", user.id)
    .eq("trucker_id", driverProfile.company_owner_id)
    .in("status", DRIVER_VISIBLE_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ loads: data || [] });
}
