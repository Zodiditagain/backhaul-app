import { supabase } from "./supabaseClient";

export async function logAuditEvent({
  actorId,
  actorRole,
  companyName,
  eventType,
  action,
  status = "success",
  bolId = null,
  matchId = null,
  targetUserId = null,
  metadata = {},
}) {
  try {
    await supabase.from("audit_events").insert({
      actor_id: actorId,
      actor_role: actorRole,
      company_name: companyName,
      event_type: eventType,
      action,
      status,
      bol_id: bolId,
      match_id: matchId,
      target_user_id: targetUserId,
      metadata,
    });
  } catch (err) {
    console.error("Failed to log audit event:", err);
  }
}
