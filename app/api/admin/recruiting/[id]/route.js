import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Lets an admin edit a lead's drafted subject/body before sending it, or
// reject it outright so it's never sent. Only leads still in "new" status
// can be edited or rejected — once sent, the record is a fixed history of
// what actually went out.
export async function PATCH(req, { params }) {
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

  const { data: lead } = await supabaseAdmin
    .from("recruit_leads")
    .select("status")
    .eq("id", params.id)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (lead.status !== "new") {
    return NextResponse.json({ error: "Only pending leads can be edited or rejected" }, { status: 400 });
  }

  const body = await req.json();
  const { action, email_subject, email_body } = body;

  const update = { updated_at: new Date().toISOString() };
  if (action === "reject") {
    update.status = "rejected";
  } else if (action === "save") {
    if (email_subject !== undefined) update.email_subject = email_subject;
    if (email_body !== undefined) update.email_body = email_body;
  } else {
    return NextResponse.json({ error: "action must be save or reject" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("recruit_leads")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: data });
}
