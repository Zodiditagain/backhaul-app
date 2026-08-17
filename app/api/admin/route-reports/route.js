import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Returns every route problem report for the admin review page. route_reports
// has no SELECT policy for regular users (see the schema) — this service-role
// route, gated on profiles.is_admin, is the only way to read them back.
export async function GET(req) {
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

  const { data: reports, error } = await supabaseAdmin
    .from("route_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // route_reports.user_id / truck_profile_id aren't DB-level foreign keys
  // into profiles/truck_profiles (profiles.id just happens to equal the
  // auth user id, same convention used everywhere else in this app), so
  // the driver's company name and vehicle profile are stitched in here
  // rather than via a Postgres join.
  const userIds = [...new Set((reports || []).map((r) => r.user_id).filter(Boolean))];
  const profileIds = [...new Set((reports || []).map((r) => r.truck_profile_id).filter(Boolean))];

  const [{ data: reporters }, { data: truckProfiles }] = await Promise.all([
    userIds.length > 0
      ? supabaseAdmin.from("profiles").select("id, company_name, role").in("id", userIds)
      : Promise.resolve({ data: [] }),
    profileIds.length > 0
      ? supabaseAdmin.from("truck_profiles").select("id, profile_name, vehicle_type").in("id", profileIds)
      : Promise.resolve({ data: [] }),
  ]);

  const reporterMap = {};
  (reporters || []).forEach((r) => {
    reporterMap[r.id] = r;
  });
  const profileMap = {};
  (truckProfiles || []).forEach((p) => {
    profileMap[p.id] = p;
  });

  const enriched = (reports || []).map((r) => ({
    ...r,
    reporter: reporterMap[r.user_id] || null,
    truck_profile: profileMap[r.truck_profile_id] || null,
  }));

  return NextResponse.json({ reports: enriched });
}
