import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Lists the drivers currently signed up under this trucking company —
// distinct from driver_invites, which tracks the links themselves.
export async function GET(req) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "trucker") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select("id, driver_full_name, created_at")
    .eq("company_owner_id", user.id)
    .eq("role", "driver")
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ drivers: data || [] });
}
