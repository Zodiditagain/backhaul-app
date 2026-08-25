"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerSidebar from "../../components/TruckerSidebar";

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

export default function CarrierProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [details, setDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    equipment: [],
    fleetSize: "1-5",
    dotNumber: "",
    mcNumber: "",
    insuranceCargo: "",
    insuranceLiability: "",
    lanes: "",
    bio: "",
    yearsActive: "",
  });

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const currentUser = sessionData.session.user;
      setUser(currentUser);

      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "company_name, role, is_admin, equipment_types, fleet_size, dot_number, mc_number, insurance_cargo, insurance_liability"
        )
        .eq("id", currentUser.id)
        .single();
      setProfile(profileData);

      const { data: detailsData } = await supabase
        .from("trucker_details")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();
      setDetails(detailsData || null);

      setForm({
        equipment: profileData?.equipment_types || [],
        fleetSize: profileData?.fleet_size || "1-5",
        dotNumber: profileData?.dot_number || "",
        mcNumber: profileData?.mc_number || "",
        insuranceCargo: profileData?.insurance_cargo || "",
        insuranceLiability: profileData?.insurance_liability || "",
        lanes: detailsData?.lanes || "",
        bio: detailsData?.bio || "",
        yearsActive: detailsData?.years_active ?? "",
      });

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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
    setSaved(false);

    await supabase
      .from("profiles")
      .update({
        fleet_size: form.fleetSize,
        equipment_types: form.equipment,
        dot_number: form.dotNumber || null,
        mc_number: form.mcNumber || null,
        insurance_cargo: form.insuranceCargo || null,
        insurance_liability: form.insuranceLiability || null,
      })
      .eq("id", user.id);

    const payload = {
      id: user.id,
      fleet_size: form.fleetSize,
      equipment: form.equipment.join(", "),
      lanes: form.lanes,
      bio: form.bio,
      years_active: form.yearsActive === "" ? 0 : Number(form.yearsActive),
    };
    const { error } = details
      ? await supabase.from("trucker_details").update(payload).eq("id", user.id)
      : await supabase.from("trucker_details").insert(payload);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setDetails((prev) => prev || { id: user.id });
    }
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
        <p className="text-slate-400 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading your carrier profile...
        </p>
      </div>
    );
  }

  const isComplete =
    profile?.company_name &&
    form.equipment.length > 0 &&
    form.dotNumber &&
    form.mcNumber &&
    form.insuranceCargo &&
    form.insuranceLiability &&
    form.bio;

  return (
    <TruckerSidebar user={user} profile={profile} title="Carrier Profile">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white">Your carrier profile</h2>
            <p className="text-sm text-slate-400 mt-1">
              This is what brokers and vendors see when they look you up.
            </p>
          </div>
          {isComplete ? (
            <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-full px-3 py-1.5">
              <BadgeCheck size={13} /> Profile Complete
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5">
              <ShieldAlert size={13} /> Incomplete
            </span>
          )}
        </div>

        <form onSubmit={saveDetails} className="bg-[#111827] border border-white/10 rounded-xl p-5">
          <label className="block text-xs uppercase tracking-wide text-slate-400 mb-2">Equipment</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
            {EQUIPMENT_OPTIONS.map(({ id, label }) => {
              const selected = form.equipment.includes(id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggleEquipment(id)}
                  className={`text-xs py-2 px-2 rounded-md border text-left transition-colors ${
                    selected
                      ? "border-blue-500 bg-blue-500/15 text-blue-300 font-semibold"
                      : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Fleet Size</label>
              <select
                value={form.fleetSize}
                onChange={(e) => setForm({ ...form, fleetSize: e.target.value })}
                className="w-full bg-[#0b1220] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
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

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <Field label="DOT Number" value={form.dotNumber} onChange={(v) => setForm({ ...form, dotNumber: v })} placeholder="e.g. 1234567" />
            <Field label="MC Number" value={form.mcNumber} onChange={(v) => setForm({ ...form, mcNumber: v })} placeholder="e.g. MC-123456" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <Field
              label="Insurance — Cargo"
              value={form.insuranceCargo}
              onChange={(v) => setForm({ ...form, insuranceCargo: v })}
              placeholder="e.g. $100K Cargo"
            />
            <Field
              label="Insurance — Liability"
              value={form.insuranceLiability}
              onChange={(v) => setForm({ ...form, insuranceLiability: v })}
              placeholder="e.g. $1M Liability"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Years Active</label>
              <input
                type="number"
                min="0"
                value={form.yearsActive}
                onChange={(e) => setForm({ ...form, yearsActive: e.target.value })}
                placeholder="e.g. 8"
                className="w-full bg-[#0b1220] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600"
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full bg-[#0b1220] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-md font-semibold text-sm uppercase tracking-wide transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Saved ✓" : details ? "Update profile" : "Save profile — get discovered"}
          </button>
        </form>
        {!details && (
          <p className="text-xs text-slate-500 italic -mt-3">
            Brokers and vendors can't find you until you save a profile.
          </p>
        )}
      </div>
    </TruckerSidebar>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0b1220] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600"
      />
    </div>
  );
}
