import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// A driver has no row of their own in truck_profiles (those belong to the
// company's account, keyed by the owner's user_id) and truck_profiles'
// own row-level security isn't written with drivers in mind, so this
// route deliberately goes through the service-role key rather than a
// direct client-side query — it looks up the driver's company first, then
// only ever returns that one company's trucks.
export async function GET(req) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: driverProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, company_owner_id, current_truck_profile_id")
    .eq("id", user.id)
    .single();

  if (driverProfile?.role !== "driver" || !driverProfile.company_owner_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from("truck_profiles")
    .select("id, profile_name, vehicle_type, truck_number, trailer_number")
    .eq("user_id", driverProfile.company_owner_id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({
    truckProfiles: data || [],
    currentTruckProfileId: driverProfile.current_truck_profile_id,
  });
}
