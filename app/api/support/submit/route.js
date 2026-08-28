import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Every support request goes straight into the open queue for a human to
// answer through the reply thread (see /admin/support and the reply box on
// each request in app/support/page.js). This used to try an automated AI
// first-pass before falling back to a human, but its failures were silent
// (a bad/missing key just quietly skipped straight to "we'll be in touch"
// with nothing visible anywhere to diagnose) — a live back-and-forth
// thread with staff is simpler and easier to trust.
export async function POST(req) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();
  if (!subject || !message) {
    return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, company_name")
    .eq("id", user.id)
    .single();

  // Broker/vendor accounts get their support requests flagged as priority
  // for now — once real billing enforcement exists everywhere, this should
  // check active subscription status instead of just role.
  const priority = profile?.role === "broker" || profile?.role === "vendor";

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("support_requests")
    .insert({ user_id: user.id, subject, message, priority })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ request: inserted });
}
