import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Lets an admin mark a support request resolved (or reopen one by mistake).
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

  const body = await req.json();
  const { action } = body;

  const update = {};
  if (action === "resolve") {
    update.status = "resolved";
    update.resolved_at = new Date().toISOString();
  } else if (action === "reopen") {
    update.status = "open";
    update.resolved_at = null;
  } else {
    return NextResponse.json({ error: "action must be resolve or reopen" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("support_requests")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ request: data });
}
