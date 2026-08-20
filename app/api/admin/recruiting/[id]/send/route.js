import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getAuthedUser } from "../../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// RECRUITING_FROM_EMAIL is just a branded "from" address on the verified
// domain — it doesn't need a real inbox behind it. Replies still need
// somewhere to land, so every send sets this as the reply-to address
// instead, routing responses/opt-outs to an inbox that's actually checked.
const RECRUITING_REPLY_TO = "lorenzomorgan6969@gmail.com";

// The only place an actual email ever goes out for the recruiting feature.
// Everything upstream of this (drafting, review, editing) is just a queue —
// nothing is sent until an admin clicks Send here, from their own logged-in
// session. Appends a plain-text footer with the business address and an
// opt-out line to every send, per basic commercial-email requirements.
export async function POST(req, { params }) {
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

  if (!process.env.RESEND_API_KEY || !process.env.RECRUITING_FROM_EMAIL) {
    return NextResponse.json(
      { error: "RESEND_API_KEY or RECRUITING_FROM_EMAIL is not configured on the server" },
      { status: 500 }
    );
  }

  const { data: lead } = await supabaseAdmin
    .from("recruit_leads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (lead.status !== "new") {
    return NextResponse.json({ error: "This lead has already been sent or rejected" }, { status: 400 });
  }

  const businessAddress = process.env.BACKHAUL_BUSINESS_ADDRESS || "";
  const footerLines = [
    "",
    "---",
    "Backhaul (joinbackhaul.com)",
    businessAddress,
    "Reply to this email and let us know if you'd rather not hear from us again.",
  ].filter(Boolean);
  const fullBody = lead.email_body + "\n\n" + footerLines.join("\n");

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sendResult, error: sendError } = await resend.emails.send({
    from: process.env.RECRUITING_FROM_EMAIL,
    to: lead.contact_email,
    subject: lead.email_subject,
    text: fullBody,
    replyTo: RECRUITING_REPLY_TO,
  });

  if (sendError) {
    return NextResponse.json({ error: sendError.message || "Resend failed to send" }, { status: 502 });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("recruit_leads")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, lead: updated, resend_id: sendResult?.id || null });
}
