"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Truck as TruckIcon, MapPin } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

export default function CompanyProfile({ params }) {
  const router = useRouter();
  const { id } = params;
  const [profile, setProfile] = useState(null);
  const [truckerDetails, setTruckerDetails] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [existingMatch, setExistingMatch] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user || null;
    setCurrentUser(user);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    setProfile(profileData);

    if (profileData?.role === "trucker") {
      const { data: details } = await supabase
        .from("trucker_details")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setTruckerDetails(details);
    }

    if (user) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setCurrentRole(myProfile?.role || null);

      // check if a match already exists between viewer and this profile
      const truckerId = profileData?.role === "trucker" ? profileData.id : user.id;
      const partnerId = profileData?.role === "trucker" ? user.id : profileData.id;

      const { data: matchRow } = await supabase
        .from("matches")
        .select("*")
        .eq("trucker_id", truckerId)
        .eq("partner_id", partnerId)
        .maybeSingle();
      setExistingMatch(matchRow || null);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleConnect() {
    if (!currentUser || !profile) return;
    setConnecting(true);
    const { error } = await supabase.from("matches").insert({
      trucker_id: profile.id,
      partner_id: currentUser.id,
      partner_role: currentRole,
    });
    setConnecting(false);
    if (!error) {
      setJustConnected(true);
      load();
    }
  }

  if (loading) return <div className="p-8 text-steelgray">Loading profile...</div>;
  if (!profile) return <div className="p-8 text-alertred">Company not found.</div>;

  const initial = (profile.company_name || "?").charAt(0).toUpperCase();
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const canConnect =
    currentUser &&
    profile.role === "trucker" &&
    (currentRole === "broker" || currentRole === "vendor") &&
    currentUser.id !== profile.id &&
    !existingMatch;

  const canMessage = !!existingMatch;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-asphalt px-5 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-white font-bold">Company Profile</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="bg-white border border-gray-300 rounded-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rotate-45 bg-amberx flex items-center justify-center shrink-0">
              <span className="-rotate-45 text-asphalt text-2xl font-bold">{initial}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-asphalt">{profile.company_name}</h2>
              <p className="text-steelgray text-sm capitalize">
                {profile.role}
                {profile.coverage_area ? ` • ${profile.coverage_area}` : ""}
              </p>
              {memberSince && (
                <p className="text-xs text-gray-400 mt-0.5">Member since {memberSince}</p>
              )}
              {existingMatch && (
                <p className="text-xs text-highway font-mono uppercase tracking-wide mt-1">Connected</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            {canConnect && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex-1 bg-asphalt hover:bg-black text-white py-2.5 rounded-sm font-mono text-sm uppercase tracking-wide transition-colors disabled:opacity-50"
              >
                {connecting ? "Connecting..." : justConnected ? "Connected" : "Connect"}
              </button>
            )}
            <button
  onClick={() => canMessage && router.push(`/dashboard?openMatch=${existingMatch.id}`)}              disabled={!canMessage}
              title={!canMessage ? "Connect first to start messaging" : ""}
              className={`flex-1 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wide transition-colors ${
                canMessage
                  ? "border border-gray-300 hover:border-asphalt"
                  : "border border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Message
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded-sm p-6 mt-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-steelgray mb-4">Business Information</h3>

          {profile.role === "trucker" ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoRow icon={<TruckIcon size={16} />} label="Fleet Size" value={profile.fleet_size} />
              <InfoRow icon={<Building2 size={16} />} label="Equipment" value={(profile.equipment_types || []).join(", ")} />
              <InfoRow icon={<MapPin size={16} />} label="Lanes" value={truckerDetails?.lanes} />
              {truckerDetails?.bio && (
                <div className="sm:col-span-2">
                  <span className="text-xs uppercase tracking-wide text-steelgray">Bio</span>
                  <p className="text-sm text-asphalt mt-1">{truckerDetails.bio}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoRow icon={<MapPin size={16} />} label="Coverage Area" value={profile.coverage_area} />
              <InfoRow icon={<Building2 size={16} />} label="Company Size" value={profile.company_size} />
              <div className="sm:col-span-2">
                <span className="text-xs uppercase tracking-wide text-steelgray">Services Offered</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(profile.services_offered || []).length > 0 ? (
                    profile.services_offered.map((s) => (
                      <span key={s} className="text-xs bg-gray-100 border border-gray-300 rounded-sm px-2 py-1">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400 italic">Not provided</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-steelgray mt-0.5">{icon}</span>
      <div>
        <div className="text-xs uppercase tracking-wide text-steelgray">{label}</div>
        <div className="text-sm text-asphalt">{value || "Not provided"}</div>
      </div>
    </div>
  );
}
