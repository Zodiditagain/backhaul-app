import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Sets (or clears) which truck profile a driver is currently running.
// Deliberately not a direct client-side update to profiles — that column
// isn't restricted to a driver's own company by the database itself, so
// this route independently verifies the requested truck actually belongs
// to the driver's own company before saving it, closing off a driver
// pointing themselves at another company's truck.
export async function POST(req) {
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

  const body = await req.json();
  const truckProfileId = body?.truckProfileId ? String(body.truckProfileId) : null;

  if (truckProfileId) {
    const { data: truck } = await supabaseAdmin
      .from("truck_profiles")
      .select("id, user_id")
      .eq("id", truckProfileId)
      .single();

    if (!truck || truck.user_id !== driverProfile.company_owner_id) {
      return NextResponse.json({ error: "That truck isn't part of your company's fleet." }, { status: 400 });
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ current_truck_profile_id: truckProfileId })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
