"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bell, MapPin, Trash2, Plus, Loader2, Crosshair } from "lucide-react";
import { supabase, authHeaders } from "../../../lib/supabaseClient";

const EQUIPMENT_OPTIONS = [
  { id: "dry_van", label: "Dry Van" },
  { id: "reefer", label: "Reefer" },
  { id: "flatbed", label: "Flatbed" },
  { id: "step_deck", label: "Step Deck" },
  { id: "hotshot", label: "Hotshot" },
  { id: "power_only", label: "Power Only" },
  { id: "box_truck", label: "Box Truck" },
];

export default function CapacityAlertsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userId, setUserId] = useState(null);

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [equipmentType, setEquipmentType] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchPoint, setSearchPoint] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("product", "partner_pro")
      .in("status", ["trialing", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) {
      router.push("/partner-pro/subscribe");
      return;
    }
    setUserId(user.id);
    setCheckingAccess(false);
  }

  const loadAlerts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("capacity_alerts")
      .select("*")
      .eq("broker_id", userId)
      .order("created_at", { ascending: false });
    setAlerts(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const fetchSuggestions = useCallback(async (q) => {
    if (q.trim().length < 3) {
      setSearchSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q, lat: "39.5", lng: "-98.35" });
      const res = await fetch("/api/here/autocomplete?" + params.toString(), { headers: await authHeaders() });
      const data = await res.json();
      setSearchSuggestions((data.items || []).filter((i) => i.lat !== null && i.lng !== null));
    } catch {
      // silent fail on suggestions
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, fetchSuggestions]);

  function selectSearchPlace(place) {
    setSearchPoint({ lat: place.lat, lng: place.lng, label: place.address });
    setSearchQuery(place.address);
    setShowSuggestions(false);
  }

  function useMyLocation() {
    setLocateError("");
    if (!navigator.geolocation) {
      setLocateError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your current location" });
        setSearchQuery("Your current location");
        setLocating(false);
      },
      (err) => {
        setLocateError("Couldn't get your location: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function createAlert() {
    setFormError("");
    if (!searchPoint) {
      setFormError("Pick a location for this alert first.");
      return;
    }
    if (!radiusMiles || radiusMiles < 1) {
      setFormError("Enter a radius greater than 0.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("capacity_alerts").insert({
      broker_id: userId,
      location_label: searchPoint.label,
      location_lat: searchPoint.lat,
      location_lng: searchPoint.lng,
      radius_miles: radiusMiles,
      equipment_type: equipmentType || null,
    });
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setShowForm(false);
    setSearchPoint(null);
    setSearchQuery("");
    setEquipmentType("");
    setRadiusMiles(100);
    loadAlerts();
  }

  async function toggleActive(alert) {
    setBusyId(alert.id);
    await supabase.from("capacity_alerts").update({ active: !alert.active }).eq("id", alert.id);
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, active: !a.active } : a)));
    setBusyId(null);
  }

  async function deleteAlert(alert) {
    setBusyId(alert.id);
    await supabase.from("capacity_alerts").delete().eq("id", alert.id);
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    setBusyId(null);
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
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Bell size={22} className="text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Capacity Alerts</h1>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-md"
          >
            <Plus size={14} /> New Alert
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          Save a location, radius, and equipment type and we'll notify you the moment a matching carrier
          marks themselves available — no more constantly refreshing the search page.
        </p>

        {showForm && (
          <div className="bg-slate-900 border border-slate-800 rounded-md p-4 mb-6">
            <label className="block text-xs font-medium text-gray-400 mb-1">Location</label>
            <div className="relative mb-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchPoint(null);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="City, address, or zip"
                    className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-amber-500"
                  />
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-md overflow-hidden shadow-lg">
                      {searchSuggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => selectSearchPlace(s)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-800 flex items-start gap-2"
                        >
                          <MapPin size={14} className="mt-0.5 text-gray-500 flex-shrink-0" />
                          <span>{s.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={useMyLocation}
                  disabled={locating}
                  className="shrink-0 flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-gray-300 text-xs font-semibold uppercase tracking-wide px-3 py-2.5 rounded-md disabled:opacity-50"
                >
                  <Crosshair size={14} />
                  {locating ? "Locating..." : "Use My Location"}
                </button>
              </div>
              {locateError && <p className="text-xs text-red-400 mt-1">{locateError}</p>}
            </div>

            <div className="flex flex-wrap gap-3 mb-3">
              <label className="text-xs text-gray-400">
                Radius:{" "}
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(Number(e.target.value) || 0)}
                  className="w-20 bg-slate-950 border border-slate-800 text-white text-xs rounded-md py-1 px-2 ml-1"
                />{" "}
                miles
              </label>
              <label className="text-xs text-gray-400">
                Equipment:{" "}
                <select
                  value={equipmentType}
                  onChange={(e) => setEquipmentType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white text-xs rounded-md py-1 px-2 ml-1"
                >
                  <option value="">Any equipment</option>
                  {EQUIPMENT_OPTIONS.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {formError && <p className="text-xs text-red-400 mb-2">{formError}</p>}

            <div className="flex items-center gap-2">
              <button
                onClick={createAlert}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-md"
              >
                {saving ? "Saving..." : "Save Alert"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs text-gray-400 hover:text-white px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading alerts...
            </p>
          ) : alerts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-8 text-center">
              <Bell size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">You don't have any capacity alerts yet.</p>
              <p className="text-gray-600 text-xs mt-1">
                Set one up above, or save a search from{" "}
                <Link href="/broker/search-carriers" className="underline hover:text-amber-400">
                  Search Carriers
                </Link>
                .
              </p>
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-md px-4 py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <MapPin size={13} className="text-amber-400 shrink-0" /> {a.location_label}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {a.radius_miles} mi radius ·{" "}
                    {a.equipment_type
                      ? EQUIPMENT_OPTIONS.find((o) => o.id === a.equipment_type)?.label || a.equipment_type
                      : "Any equipment"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(a)}
                    disabled={busyId === a.id}
                    className={
                      "text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-md border disabled:opacity-50 " +
                      (a.active
                        ? "bg-green-500/15 border-green-500/40 text-green-400"
                        : "bg-slate-800 border-slate-700 text-gray-400")
                    }
                  >
                    {a.active ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={() => deleteAlert(a)}
                    disabled={busyId === a.id}
                    title="Delete alert"
                    className="p-1.5 rounded-md border border-slate-800 bg-slate-950 text-gray-400 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
