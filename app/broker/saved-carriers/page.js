"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, Truck, MessageCircle, BadgeCheck } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

const EQUIPMENT_OPTIONS = [
  { id: "dry_van", label: "Dry Van" },
  { id: "reefer", label: "Reefer" },
  { id: "flatbed", label: "Flatbed" },
  { id: "step_deck", label: "Step Deck" },
  { id: "hotshot", label: "Hotshot" },
  { id: "power_only", label: "Power Only" },
  { id: "box_truck", label: "Box Truck" },
];

export default function SavedCarriersPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userId, setUserId] = useState(null);
  const [partnerRole, setPartnerRole] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "trucker") {
      router.push("/dashboard");
      return;
    }
    setUserId(user.id);
    setPartnerRole(profile?.role || null);
    setCheckingAccess(false);
  }

  const loadSaved = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("saved_carriers")
      .select(
        "id, trucker_id, created_at, trucker:profiles!saved_carriers_trucker_id_fkey(id, company_name, equipment_types, fleet_size, dot_number, available_now, city, state)"
      )
      .eq("partner_id", userId)
      .order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  async function unsave(truckerId) {
    setBusyId(truckerId);
    await supabase.from("saved_carriers").delete().eq("partner_id", userId).eq("trucker_id", truckerId);
    setRows((prev) => prev.filter((r) => r.trucker_id !== truckerId));
    setBusyId(null);
  }

  async function messageCarrier(truckerId) {
    setBusyId(truckerId);
    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("trucker_id", truckerId)
      .eq("partner_id", userId)
      .maybeSingle();
    let matchId = existing?.id;
    if (!matchId) {
      const { data: created, error } = await supabase
        .from("matches")
        .insert({ trucker_id: truckerId, partner_id: userId, partner_role: partnerRole, status: "pending" })
        .select("id")
        .single();
      if (error) {
        alert("Couldn't start a conversation: " + error.message);
        setBusyId(null);
        return;
      }
      matchId = created.id;
    }
    router.push("/dashboard?openMatch=" + matchId);
  }

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Checking your access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-4"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <Star size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Saved Carriers</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          Carriers you've saved from Search Carriers. Come back here any time to message them again
          without having to search from scratch.
        </p>

        <div className="space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading saved carriers...</p>
          ) : rows.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-8 text-center">
              <Star size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">You haven't saved any carriers yet.</p>
              <Link
                href="/broker/search-carriers"
                className="inline-block mt-3 text-xs font-semibold uppercase tracking-wide bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md"
              >
                Search Carriers
              </Link>
            </div>
          ) : (
            rows.map((r) => {
              const t = r.trucker;
              if (!t) return null;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-md px-4 py-3 transition gap-3"
                >
                  <Link href={"/company/" + t.id} className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <Truck size={16} className="text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{t.company_name}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        {(t.equipment_types || []).slice(0, 3).map((eq) => (
                          <span
                            key={eq}
                            className="text-[10px] uppercase tracking-wide text-gray-500 bg-slate-800 rounded px-1.5 py-0.5"
                          >
                            {EQUIPMENT_OPTIONS.find((o) => o.id === eq)?.label || eq}
                          </span>
                        ))}
                        {t.fleet_size && <span className="text-[10px] text-gray-500">Fleet: {t.fleet_size}</span>}
                      </div>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <BadgeCheck size={10} /> {t.dot_number ? "DOT on file: " + t.dot_number : "No DOT on file"}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.available_now && (
                      <span className="text-[10px] uppercase tracking-wide text-green-400 bg-green-500/15 border border-green-500/40 rounded px-1.5 py-0.5">
                        Available
                      </span>
                    )}
                    <button
                      onClick={() => messageCarrier(t.id)}
                      disabled={busyId === t.id}
                      title="Message this carrier"
                      className="p-1.5 rounded-md border border-slate-800 bg-slate-950 text-gray-400 hover:text-white disabled:opacity-50"
                    >
                      <MessageCircle size={13} />
                    </button>
                    <button
                      onClick={() => unsave(t.id)}
                      disabled={busyId === t.id}
                      title="Remove from saved carriers"
                      className="p-1.5 rounded-md border border-amber-500 bg-amber-500/20 text-amber-400 disabled:opacity-50"
                    >
                      <Star size={13} fill="currentColor" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
