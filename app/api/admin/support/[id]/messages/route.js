import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Lets an admin post a reply into a support request's thread. This is
// separate from the resolve/reopen action in [id]/route.js — staff can
// reply as many times as needed while a ticket stays open, and resolving
// it is still a distinct, explicit step.
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

  const body = (await req.json().catch(() => ({}))) || {};
  const message = (body.message || "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const { data: request, error: requestError } = await supabaseAdmin
    .from("support_requests")
    .select("id")
    .eq("id", params.id)
    .single();

  if (requestError || !request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("support_messages")
    .insert({
      request_id: request.id,
      sender_role: "admin",
      author_id: user.id,
      body: message,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ message: inserted });
}
