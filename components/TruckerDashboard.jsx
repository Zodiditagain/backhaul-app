"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Handshake, Fuel, Building2, Package as PackageIcon } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import GradeBadge, { computeStats } from "./GradeBadge";
import MatchThread from "./MatchThread";

const EQUIPMENT_OPTIONS = [
  { id: "dry_van", label: "Dry Van" },
  { id: "reefer", label: "Reefer" },
  { id: "flatbed", label: "Flatbed" },
  { id: "step_deck", label: "Step Deck" },
  { id: "hotshot", label: "Hotshot" },
  { id: "power_only", label: "Power Only" },
  { id: "box_truck", label: "Box Truck" },
  { id: "manual_pallet_jack", label: "Manual Pallet Jack" },
  { id: "straps", label: "Straps" },
  { id: "tarps", label: "Tarps" },
  { id: "freight_blankets", label: "Freight Blankets" },
  { id: "other", label: "Other" },
];

export default function TruckerDashboard({ user }) {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({ lanes: "", bio: "", fleetSize: "1-5", equipment: [] });
  const [matches, setMatches] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadEverything() {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("equipment_types, fleet_size, operator_type, company_name")
      .eq("id", user.id)
      .single();
    setProfile(profileData);

    const { data: detailsData } = await supabase
      .from("trucker_details")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (detailsData) {
      setDetails(detailsData);
    }

    setForm({
      lanes: detailsData?.lanes || "",
      bio: detailsData?.bio || "",
      fleetSize: profileData?.fleet_size || "1-5",
      equipment: profileData?.equipment_types || [],
    });

    const { data: matchData } = await supabase
      .from("matches")
      .select("*, partner:profiles!matches_partner_id_fkey(company_name, role)")
      .eq("trucker_id", user.id)
      .order("created_at", { ascending: false });
    setMatches(matchData || []);

    const openMatchId = searchParams.get("openMatch");
    if (openMatchId) {
      const found = (matchData || []).find((m) => m.id === openMatchId);
      if (found) setActiveMatch(found);
    }

    const { data: reviewData } = await supabase
      .from("reviews")
      .select("on_time, condition")
      .eq("trucker_id", user.id);
    setReviews(reviewData || []);

    setLoading(false);
  }

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleEquipment(id) {
    setForm((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(id)
        ? prev.equipment.filter((e) => e !== id)
        : [...prev.equipment, id],
    }));
  }

  async function saveDetails(e) {
    e.preventDefault();
    setSaving(true);

    await supabase
      .from("profiles")
      .update({
        fleet_size: form.fleetSize,
        equipment_types: form.equipment,
      })
      .eq("id", user.id);

    const payload = {
      id: user.id,
      fleet_size: form.fleetSize,
      equipment: form.equipment.join(", "),
      lanes: form.lanes,
      bio: form.bio,
      years_active: details?.years_active || 0,
    };
    const { error } = details
      ? await supabase.from("trucker_details").update(payload).eq("id", user.id)
      : await supabase.from("trucker_details").insert(payload);

    setSaving(false);
    if (!error) loadEverything();
  }

  const stats = computeStats(reviews);
  const brokerMatches = matches.filter((m) => m.partner_role === "broker");
  const vendorMatches = matches.filter((m) => m.partner_role === "vendor");
  const firstName = (profile?.company_name || "there").split(" ")[0];

  if (loading) return <p className="text-steelgray">Loading your dashboard...</p>;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-asphalt">Good morning, {firstName} 👋</h1>
        <p className="text-steelgray text-sm mt-1">Here's what's happening in your network.</p>
        <div
          className="mt-4 h-px w-full"
          style={{
            backgroundImage: "repeating-linear-gradient(90deg, #F2A93B 0 16px, transparent 16px 28px)",
          }}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={<Building2 size={16} />} label="Broker Matches" value={brokerMatches.length} />
        <StatCard icon={<PackageIcon size={16} />} label="Vendor Matches" value={vendorMatches.length} />
        <div className="col-span-2 sm:col-span-1 bg-asphalt rounded-sm p-4 flex flex-col justify-between">
          <span className="text-xs uppercase tracking-widest text-gray-400 font-mono">Your Grade</span>
          <div className="mt-2">
            <GradeBadge grade={stats.grade} reviewCount={stats.reviewCount} />
          </div>
        </div>
      </div>

      {/* Profile section */}
      <section>
        <div className="flex items-center justify-between border-b border-gray-300 pb-2">
          <h2 className="text-xl font-bold text-asphalt">Your carrier profile</h2>
        </div>
        <form onSubmit={saveDetails} className="mt-3 bg-white border border-gray-300 rounded-sm p-4">
          <label className="block text-xs uppercase tracking-wide text-steelgray mb-2">Equipment</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {EQUIPMENT_OPTIONS.map(({ id, label }) => {
              const selected = form.equipment.includes(id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggleEquipment(id)}
                  className={`text-xs py-2 px-2 rounded-sm border-2 transition text-left ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white font-semibold shadow-sm"
                      : "border-gray-300 bg-gray-50 text-steelgray"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Fleet Size</label>
              <select
                value={form.fleetSize}
                onChange={(e) => setForm({ ...form, fleetSize: e.target.value })}
                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm bg-white"
              >
                <option value="1">Just me</option>
                <option value="1-5">1 - 5 trucks</option>
                <option value="6-20">6 - 20 trucks</option>
                <option value="21-50">21 - 50 trucks</option>
                <option value="50+">50+ trucks</option>
              </select>
            </div>
            <Field label="Lanes you run" value={form.lanes} onChange={(v) => setForm({ ...form, lanes: v })} placeholder="CA, WA, OR" />
          </div>

          <div className="mb-3">
            <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-asphalt hover:bg-black text-white py-2.5 rounded-sm font-mono text-sm uppercase tracking-wide transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : details ? "Update profile" : "Save profile — get discovered"}
          </button>
        </form>
        {!details && (
          <p className="text-xs text-steelgray italic mt-2">
            Brokers and vendors can't find you until you save a profile.
          </p>
        )}
      </section>

      {/* Connections + conversation */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-xl font-bold text-asphalt border-b border-gray-300 pb-2">Companies interested in you</h2>
          <div className="space-y-2 mt-3">
            {matches.map((m) => (
              <div
                key={m.id}
                className={`w-full bg-white border rounded-sm px-4 py-3 flex items-center justify-between transition-colors ${
                  activeMatch?.id === m.id
                    ? "border-amberx border-l-4"
                    : "border-gray-300 border-l-4 border-l-transparent hover:border-l-amberx/60"
                }`}
              >
                <button onClick={() => setActiveMatch(m)} className="flex items-center gap-3 text-left flex-1">
                  <div className="w-8 h-8 rotate-45 bg-asphalt/5 border border-asphalt/10 flex items-center justify-center shrink-0">
                    {m.partner_role === "vendor" ? (
                      <Fuel size={14} className="-rotate-45 text-steelgray" />
                    ) : (
                      <Handshake size={14} className="-rotate-45 text-steelgray" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{m.partner?.company_name}</div>
                    <div className="text-xs text-gray-400 font-mono uppercase tracking-wide">{m.partner_role}</div>
                  </div>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <Link href={`/company/${m.partner_id}`} className="text-xs text-steelgray hover:text-amberx underline whitespace-nowrap">
                    View Profile
                  </Link>
                  <button onClick={() => setActiveMatch(m)}>
                    <MessageCircle size={15} className="text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
            {matches.length === 0 && <p className="text-sm text-steelgray italic py-4">No matches yet.</p>}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-bold text-asphalt border-b border-gray-300 pb-2">Conversation</h2>
          <div className="mt-3">
            {activeMatch ? (
              <MatchThread match={activeMatch} user={user} role="trucker" />
            ) : (
              <p className="text-sm text-steelgray italic py-4">Select a conversation to negotiate.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-asphalt rounded-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-gray-400 font-mono">{label}</span>
        <div className="w-6 h-6 rotate-45 bg-amberx flex items-center justify-center">
          <span className="-rotate-45 text-asphalt">{icon}</span>
        </div>
      </div>
      <span className="text-3xl font-bold text-white">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
      />
    </div>
  );
}
