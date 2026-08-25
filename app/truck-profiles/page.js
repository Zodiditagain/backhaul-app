"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  Star,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerSidebar from "../../components/TruckerSidebar";

const VEHICLE_TYPES = [
  { value: "tractor_trailer", label: "Tractor-Trailer" },
  { value: "straight_truck", label: "Straight Truck / Box Truck" },
  { value: "dry_van", label: "Dry Van" },
  { value: "reefer", label: "Reefer" },
  { value: "flatbed", label: "Flatbed" },
  { value: "other", label: "Other" },
];

const HAZMAT_CATEGORIES = [
  "explosive",
  "gas",
  "flammable",
  "combustible",
  "organic",
  "poison",
  "radioactive",
  "corrosive",
  "poisonousInhalation",
  "harmfulToWater",
  "other",
];

const TUNNEL_CATEGORIES = ["B", "C", "D", "E"];

const EMPTY_FORM = {
  profile_name: "",
  vehicle_type: "tractor_trailer",
  heightFt: "",
  heightIn: "",
  widthFt: "",
  widthIn: "",
  lengthFt: "",
  lengthIn: "",
  trailerLengthFt: "",
  trailerLengthIn: "",
  current_weight_lbs: "",
  gross_weight_lbs: "",
  weight_per_axle_lbs: "",
  axle_count: "",
  hazmat: false,
  hazmat_categories: [],
  tunnel_category: "",
  avoid_tolls: false,
  avoid_ferries: false,
  prefer_highways: false,
  is_default: false,
};

function totalInches(ft, inch) {
  const f = parseFloat(ft) || 0;
  const i = parseFloat(inch) || 0;
  const total = f * 12 + i;
  return total > 0 ? total : null;
}

function splitInches(totalIn) {
  if (!totalIn && totalIn !== 0) return { ft: "", in: "" };
  const total = Number(totalIn);
  if (!total) return { ft: "", in: "" };
  return { ft: String(Math.floor(total / 12)), in: String(Math.round(total % 12)) };
}

function formatFeetInches(totalIn) {
  if (!totalIn) return null;
  const total = Number(totalIn);
  const ft = Math.floor(total / 12);
  const inch = Math.round(total % 12);
  return `${ft}' ${inch}"`;
}

export default function TruckProfilesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("company_name, role, is_admin")
        .eq("id", user.id)
        .single();
      setProfile(profileData);
      await loadProfiles();
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadProfiles() {
    const { data, error: loadError } = await supabase
      .from("truck_profiles")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (loadError) {
      setError("Couldn't load your truck profiles.");
      return;
    }
    setProfiles(data || []);
  }

  function openNewForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  function openEditForm(p) {
    const h = splitInches(p.height_inches);
    const w = splitInches(p.width_inches);
    const l = splitInches(p.length_inches);
    const tl = splitInches(p.trailer_length_inches);
    setForm({
      profile_name: p.profile_name || "",
      vehicle_type: p.vehicle_type || "tractor_trailer",
      heightFt: h.ft,
      heightIn: h.in,
      widthFt: w.ft,
      widthIn: w.in,
      lengthFt: l.ft,
      lengthIn: l.in,
      trailerLengthFt: tl.ft,
      trailerLengthIn: tl.in,
      current_weight_lbs: p.current_weight_lbs ?? "",
      gross_weight_lbs: p.gross_weight_lbs ?? "",
      weight_per_axle_lbs: p.weight_per_axle_lbs ?? "",
      axle_count: p.axle_count ?? "",
      hazmat: !!p.hazmat,
      hazmat_categories: p.hazmat_categories || [],
      tunnel_category: p.tunnel_category || "",
      avoid_tolls: !!p.avoid_tolls,
      avoid_ferries: !!p.avoid_ferries,
      prefer_highways: !!p.prefer_highways,
      is_default: !!p.is_default,
    });
    setEditingId(p.id);
    setShowForm(true);
    setError("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function toggleHazmatCategory(cat) {
    setForm((prev) => ({
      ...prev,
      hazmat_categories: prev.hazmat_categories.includes(cat)
        ? prev.hazmat_categories.filter((c) => c !== cat)
        : [...prev.hazmat_categories, cat],
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.profile_name.trim()) {
      setError("Give this profile a name, e.g. \"2025 Freightliner + 53' Dry Van\".");
      return;
    }
    setSaving(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const payload = {
      user_id: user.id,
      profile_name: form.profile_name.trim(),
      vehicle_type: form.vehicle_type,
      height_inches: totalInches(form.heightFt, form.heightIn),
      width_inches: totalInches(form.widthFt, form.widthIn),
      length_inches: totalInches(form.lengthFt, form.lengthIn),
      trailer_length_inches: totalInches(form.trailerLengthFt, form.trailerLengthIn),
      current_weight_lbs: form.current_weight_lbs ? Number(form.current_weight_lbs) : null,
      gross_weight_lbs: form.gross_weight_lbs ? Number(form.gross_weight_lbs) : null,
      weight_per_axle_lbs: form.weight_per_axle_lbs ? Number(form.weight_per_axle_lbs) : null,
      axle_count: form.axle_count ? Number(form.axle_count) : null,
      hazmat: form.hazmat,
      hazmat_categories: form.hazmat ? form.hazmat_categories : [],
      tunnel_category: form.tunnel_category || null,
      avoid_tolls: form.avoid_tolls,
      avoid_ferries: form.avoid_ferries,
      prefer_highways: form.prefer_highways,
      is_default: form.is_default,
    };

    // Only one profile can be default at a time — clear any existing
    // default first so the new/edited one is unambiguous.
    if (payload.is_default) {
      await supabase
        .from("truck_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true);
    }

    let saveError;
    if (editingId) {
      const { error: updateError } = await supabase
        .from("truck_profiles")
        .update(payload)
        .eq("id", editingId);
      saveError = updateError;
    } else {
      const { error: insertError } = await supabase.from("truck_profiles").insert(payload);
      saveError = insertError;
    }

    if (saveError) {
      setError("Couldn't save this profile. Try again.");
      setSaving(false);
      return;
    }

    await loadProfiles();
    setSaving(false);
    closeForm();
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Delete this truck profile? This can't be undone.");
    if (!confirmed) return;
    setDeletingId(id);
    const { error: deleteError } = await supabase.from("truck_profiles").delete().eq("id", id);
    if (!deleteError) {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    }
    setDeletingId(null);
  }

  async function handleSetDefault(p) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("truck_profiles")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true);
    await supabase.from("truck_profiles").update({ is_default: true }).eq("id", p.id);
    await loadProfiles();
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Loading your truck profiles...</p>
      </div>
    );
  }

  return (
    <TruckerSidebar user={user} profile={profile} title="Truck & Equipment">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Truck size={22} className="text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Truck Profiles</h1>
          </div>
          {!showForm && (
            <button
              onClick={openNewForm}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 rounded-md"
            >
              <Plus size={15} /> Add Profile
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 mb-6">
          Save your vehicle&apos;s dimensions and weight once — the Route Map uses whichever
          profile you select to route around low bridges, weight-restricted roads, and other
          truck restrictions.
        </p>

        {error && !showForm && (
          <div className="bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-md p-3 mb-4">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSave}
            className="bg-slate-900 border border-slate-800 rounded-lg p-5 mb-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">
                {editingId ? "Edit Profile" : "New Truck Profile"}
              </h2>
              <button type="button" onClick={closeForm} className="text-gray-500 hover:text-gray-300">
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-md p-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Profile Name</label>
              <input
                value={form.profile_name}
                onChange={(e) => setForm({ ...form, profile_name: e.target.value })}
                placeholder="2025 Freightliner + 53' Dry Van"
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Vehicle Type</label>
              <select
                value={form.vehicle_type}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <FeetInchesField
                label="Height"
                ft={form.heightFt}
                inch={form.heightIn}
                onChange={(ft, inch) => setForm({ ...form, heightFt: ft, heightIn: inch })}
              />
              <FeetInchesField
                label="Width"
                ft={form.widthFt}
                inch={form.widthIn}
                onChange={(ft, inch) => setForm({ ...form, widthFt: ft, widthIn: inch })}
              />
              <FeetInchesField
                label="Total Length"
                ft={form.lengthFt}
                inch={form.lengthIn}
                onChange={(ft, inch) => setForm({ ...form, lengthFt: ft, lengthIn: inch })}
              />
              <FeetInchesField
                label="Trailer Length (optional)"
                ft={form.trailerLengthFt}
                inch={form.trailerLengthIn}
                onChange={(ft, inch) => setForm({ ...form, trailerLengthFt: ft, trailerLengthIn: inch })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Current Loaded Weight (lb)
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.current_weight_lbs}
                  onChange={(e) => setForm({ ...form, current_weight_lbs: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Gross Vehicle Weight (lb)
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.gross_weight_lbs}
                  onChange={(e) => setForm({ ...form, gross_weight_lbs: e.target.value })}
                  placeholder="e.g. 80000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Weight per Axle (lb)
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.weight_per_axle_lbs}
                  onChange={(e) => setForm({ ...form, weight_per_axle_lbs: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Number of Axles
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.axle_count}
                  onChange={(e) => setForm({ ...form, axle_count: e.target.value })}
                  placeholder="e.g. 5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.hazmat}
                  onChange={(e) => setForm({ ...form, hazmat: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Carrying hazardous materials
              </label>
              {form.hazmat && (
                <div className="pl-6 flex flex-wrap gap-2">
                  {HAZMAT_CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => toggleHazmatCategory(cat)}
                      className={`text-[11px] px-2 py-1 rounded-full border ${
                        form.hazmat_categories.includes(cat)
                          ? "bg-amber-500/20 border-amber-500 text-amber-300"
                          : "bg-slate-800 border-slate-700 text-gray-400"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Tunnel Restriction Category (optional)
                </label>
                <select
                  value={form.tunnel_category}
                  onChange={(e) => setForm({ ...form, tunnel_category: e.target.value })}
                  className="w-full sm:w-48 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
                >
                  <option value="">None</option>
                  {TUNNEL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      Category {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-2">
              <p className="text-xs font-medium text-gray-400 mb-1">Route Preferences</p>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.avoid_tolls}
                  onChange={(e) => setForm({ ...form, avoid_tolls: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Avoid tolls
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.avoid_ferries}
                  onChange={(e) => setForm({ ...form, avoid_ferries: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Avoid ferries
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.prefer_highways}
                  onChange={(e) => setForm({ ...form, prefer_highways: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Prefer major highways{" "}
                <span className="text-gray-600">(not yet supported by HERE — saved for later)</span>
              </label>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Use as my default profile
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Saving..." : "Save Profile"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {profiles.length === 0 && !showForm && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center text-sm text-gray-500">
              No truck profiles saved yet. Add one so the Route Map can route around your
              vehicle&apos;s specific restrictions.
            </div>
          )}
          {profiles.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-start justify-between gap-3 flex-wrap"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold">{p.profile_name}</span>
                  {p.is_default && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full px-2 py-0.5">
                      <Star size={10} /> Default
                    </span>
                  )}
                  {p.hazmat && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide bg-red-500/20 text-red-300 border border-red-500/40 rounded-full px-2 py-0.5">
                      <AlertTriangle size={10} /> Hazmat
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {VEHICLE_TYPES.find((t) => t.value === p.vehicle_type)?.label || p.vehicle_type}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                  {p.height_inches && <span>H: {formatFeetInches(p.height_inches)}</span>}
                  {p.width_inches && <span>W: {formatFeetInches(p.width_inches)}</span>}
                  {p.length_inches && <span>L: {formatFeetInches(p.length_inches)}</span>}
                  {p.gross_weight_lbs && (
                    <span>GVW: {Number(p.gross_weight_lbs).toLocaleString()} lb</span>
                  )}
                  {p.axle_count && <span>Axles: {p.axle_count}</span>}
                  {p.avoid_tolls && <span>No tolls</span>}
                  {p.avoid_ferries && <span>No ferries</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!p.is_default && (
                  <button
                    onClick={() => handleSetDefault(p)}
                    className="text-[11px] uppercase tracking-wide text-gray-400 hover:text-amber-300 px-2 py-1.5 rounded-md border border-slate-700"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => openEditForm(p)}
                  className="text-gray-400 hover:text-blue-400 p-1.5 rounded-md border border-slate-700"
                  aria-label="Edit profile"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deletingId === p.id}
                  className="text-gray-400 hover:text-red-400 p-1.5 rounded-md border border-slate-700 disabled:opacity-50"
                  aria-label="Delete profile"
                >
                  {deletingId === p.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </TruckerSidebar>
  );
}

function FeetInchesField({ label, ft, inch, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          value={ft}
          onChange={(e) => onChange(e.target.value, inch)}
          placeholder="ft"
          className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-2 text-sm text-white placeholder-gray-600"
        />
        <input
          type="number"
          min="0"
          max="11"
          value={inch}
          onChange={(e) => onChange(ft, e.target.value)}
          placeholder="in"
          className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-2 text-sm text-white placeholder-gray-600"
        />
      </div>
    </div>
  );
}
