"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, LogOut, Loader2 } from "lucide-react";
import { supabase, authHeaders } from "../../lib/supabaseClient";

const VEHICLE_TYPE_LABELS = {
  tractor_trailer: "Tractor-Trailer",
  straight_truck: "Straight Truck / Box Truck",
  dry_van: "Dry Van",
  reefer: "Reefer",
  flatbed: "Flatbed",
  other: "Other",
};

// Deliberately the only page a driver account ever lands on. Drivers have
// no access to matches, messages, brokers, or vendors — the one thing
// this page lets a driver do is say which of the company's trucks/
// trailers they're currently running, so the company can see who's in
// what. Everything else about the truck (dimensions, weight, etc.) is
// still only editable by the company account on Truck Profiles.
export default function DriverHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const [truckProfiles, setTruckProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  async function loadAssignment() {
    const headers = await authHeaders();
    const res = await fetch("/api/driver/truck-profiles", { headers });
    if (!res.ok) return;
    const json = await res.json();
    setTruckProfiles(json.truckProfiles || []);
    setSelectedId(json.currentTruckProfileId || "");
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, company_name, driver_full_name")
        .eq("id", user.id)
        .single();

      if (profileData?.role !== "driver") {
        // Not a driver account — this page isn't for them.
        router.replace("/dashboard");
        return;
      }
      setProfile(profileData);
      await loadAssignment();
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleAssignmentChange(e) {
    const value = e.target.value;
    setSelectedId(value);
    setSavingAssignment(true);
    setAssignmentError("");

    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const res = await fetch("/api/driver/assignment", {
      method: "POST",
      headers,
      body: JSON.stringify({ truckProfileId: value || null }),
    });
    const json = await res.json().catch(() => ({}));
    setSavingAssignment(false);
    if (!res.ok) {
      setAssignmentError(json.error || "Couldn't save that. Try again.");
      await loadAssignment();
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  const selected = truckProfiles.find((t) => t.id === selectedId) || null;

  return (
    <div className="min-h-screen bg-[#0b1220] flex items-center justify-center px-6 py-10">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rotate-45 bg-blue-600 flex items-center justify-center rounded-lg mx-auto mb-6">
          <Truck className="-rotate-45" size={26} color="#ffffff" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">
          {profile.driver_full_name || "Welcome"}
        </h1>
        <p className="text-blue-400 text-sm mb-6">Driving for {profile.company_name}</p>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-left mb-4">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Which truck are you running today?
          </label>
          {truckProfiles.length === 0 ? (
            <p className="text-sm text-gray-500">
              No trucks have been added to your company&apos;s fleet yet — ask your dispatcher to add
              one under Truck & Equipment.
            </p>
          ) : (
            <>
              <div className="relative">
                <select
                  value={selectedId}
                  onChange={handleAssignmentChange}
                  disabled={savingAssignment}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  <option value="">Not currently assigned</option>
                  {truckProfiles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.profile_name}
                      {t.truck_number ? ` — Truck #${t.truck_number}` : ""}
                      {t.trailer_number ? ` / Trailer #${t.trailer_number}` : ""}
                    </option>
                  ))}
                </select>
                {savingAssignment && (
                  <Loader2 size={14} className="animate-spin text-gray-500 absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
              {assignmentError && <p className="text-red-400 text-xs mt-2">{assignmentError}</p>}
              {selected && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-gray-400 space-y-1">
                  <p>{VEHICLE_TYPE_LABELS[selected.vehicle_type] || selected.vehicle_type}</p>
                  {selected.truck_number && <p>Truck #{selected.truck_number}</p>}
                  {selected.trailer_number && <p>Trailer #{selected.trailer_number}</p>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-gray-400 mb-6">
          This account is set up for identification purposes. It doesn&apos;t have access to loads,
          messages, or broker/vendor information — that stays with your company&apos;s main account.
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 justify-center w-full bg-slate-800 hover:bg-slate-700 text-gray-300 text-sm font-medium py-2.5 rounded-md border border-slate-700"
        >
          <LogOut size={15} /> Log out
        </button>
      </div>
    </div>
  );
}
