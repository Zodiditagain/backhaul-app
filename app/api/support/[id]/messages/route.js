import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Lets a customer add a follow-up message to one of their own existing
// support requests, instead of only ever being able to submit a brand new
// one. If the request had already been marked resolved, following up
// reopens it — the same behavior most support inboxes use, since a reply
// almost always means the issue isn't actually settled.
export async function POST(req, { params }) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) || {};
  const message = (body.message || "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const { data: request, error: requestError } = await supabaseAdmin
    .from("support_requests")
    .select("id, user_id, status")
    .eq("id", params.id)
    .single();

  if (requestError || !request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (request.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("support_messages")
    .insert({
      request_id: request.id,
      sender_role: "user",
      author_id: user.id,
      body: message,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (request.status === "resolved") {
    await supabaseAdmin
      .from("support_requests")
      .update({ status: "open", resolved_at: null })
      .eq("id", request.id);
  }

  return NextResponse.json({ message: inserted });
}
