import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Each entry: the status a BOL must currently be in for this action to be
// allowed, and the status it moves to. This is the same pickup -> in
// transit -> delivered -> receiver-signed sequence the owner/broker side
// already uses in components/MatchThread.jsx -- just re-implemented here so
// a driver can drive it themselves, scoped to only the one load assigned
// to them.
const ACTIONS = {
  ready_for_pickup: { from: "accepted", to: "ready_for_pickup" },
  signed_at_pickup: { from: "ready_for_pickup", to: "signed_at_pickup", requires: ["driverSignatureName"] },
  in_transit: { from: "signed_at_pickup", to: "in_transit" },
  delivered: { from: "in_transit", to: "delivered" },
  receiver_signed: { from: "delivered", to: "receiver_signed", requires: ["receiverSignatureName"] },
};

async function logAudit(bolId, userId, action, details) {
  await supabaseAdmin.from("bol_audit_log").insert({
    bol_id: bolId,
    user_id: userId,
    action,
    details: details || null,
  });
}

async function notify(recipientId, matchId, bolId, title, message) {
  if (!recipientId) return;
  await supabaseAdmin.from("notifications").insert({
    user_id: recipientId,
    match_id: matchId,
    bol_id: bolId,
    title,
    message: message || null,
  });
}

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
  const body = await req.json().catch(() => ({}));
  const action = ACTIONS[body?.action];

  if (!action) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  for (const field of action.requires || []) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  const { data: bol, error: bolError } = await supabaseAdmin
    .from("bols")
    .select("id, status, bol_number, match_id, broker_id, trucker_id, assigned_driver_id")
    .eq("id", bolId)
    .single();

  if (bolError || !bol) {
    return NextResponse.json({ error: "Load not found." }, { status: 404 });
  }

  // The two checks that matter: this load is actually assigned to this
  // driver, and it belongs to this driver's own company -- not just anyone
  // who happens to know a bol id.
  if (bol.assigned_driver_id !== user.id || bol.trucker_id !== driverProfile.company_owner_id) {
    return NextResponse.json({ error: "This load isn't assigned to you." }, { status: 403 });
  }

  if (bol.status !== action.from) {
    return NextResponse.json(
      { error: `This load is currently "${bol.status}" and can't move to "${action.to}" from there.` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  let updateFields = { status: action.to, updated_at: now };
  let messageText = "";
  let auditDetails = "";
  let notifTitle = "";
  let notifMessage = "";

  if (action.to === "ready_for_pickup") {
    messageText = `🚚 BOL ${bol.bol_number} marked ready for pickup.`;
    notifTitle = "Ready for pickup";
    notifMessage = `${bol.bol_number} is ready for pickup.`;
  } else if (action.to === "signed_at_pickup") {
    updateFields = {
      ...updateFields,
      driver_signature_name: body.driverSignatureName,
      driver_signature_at: now,
      shipper_signature_name: body.shipperSignatureName || null,
      shipper_signature_at: body.shipperSignatureName ? now : null,
      pickup_condition: body.pickupCondition || null,
      pickup_pieces_count: body.pickupPieces || null,
      picked_up_at: now,
    };
    messageText = `✍️ BOL ${bol.bol_number} signed at pickup by ${body.driverSignatureName}.`;
    auditDetails = `Driver signature: ${body.driverSignatureName}${body.shipperSignatureName ? `, Shipper signature: ${body.shipperSignatureName}` : ""}`;
    notifTitle = "Signed at pickup";
    notifMessage = `${bol.bol_number} signed at pickup by ${body.driverSignatureName}.`;
  } else if (action.to === "in_transit") {
    messageText = `🛣️ BOL ${bol.bol_number} is now in transit.`;
    notifTitle = "Load in transit";
    notifMessage = `${bol.bol_number} is now in transit.`;
  } else if (action.to === "delivered") {
    updateFields = { ...updateFields, delivered_at: now };
    messageText = `📦 BOL ${bol.bol_number} marked delivered.`;
    notifTitle = "Load delivered";
    notifMessage = `${bol.bol_number} marked delivered.`;
  } else if (action.to === "receiver_signed") {
    updateFields = {
      ...updateFields,
      receiver_signature_name: body.receiverSignatureName,
      receiver_signature_at: now,
      delivery_condition: body.deliveryCondition || null,
      delivery_pieces_count: body.deliveryPieces || null,
    };
    messageText = `✍️ Receiver signature captured for BOL ${bol.bol_number} (${body.receiverSignatureName}).`;
    auditDetails = `Receiver signature: ${body.receiverSignatureName}`;
    notifTitle = "Receiver signed";
    notifMessage = `${bol.bol_number} — receiver signature captured (${body.receiverSignatureName}).`;
  }

  const { error: updateError } = await supabaseAdmin.from("bols").update(updateFields).eq("id", bolId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (messageText) {
    await supabaseAdmin.from("messages").insert({
      match_id: bol.match_id,
      sender_id: user.id,
      text: messageText,
    });
  }
  await logAudit(bolId, user.id, action.to, auditDetails || null);
  await notify(bol.broker_id, bol.match_id, bolId, notifTitle, notifMessage);

  return NextResponse.json({ success: true });
}
