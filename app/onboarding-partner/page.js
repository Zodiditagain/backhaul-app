"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const BROKER_SERVICES = [
  "Freight Brokerage",
  "Fuel Discounts",
  "Insurance",
  "Factoring",
  "Maintenance & Repair",
  "Load Boards",
  "Compliance/ELD",
  "Other",
];

const VENDOR_SERVICES = [
  "Fuel Discounts",
  "Insurance",
  "Factoring",
  "Maintenance & Repair",
  "Load Boards",
  "Compliance/ELD",
  "Other",
];

export default function OnboardingPartner() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [services, setServices] = useState([]);
  const [coverageArea, setCoverageArea] = useState("");
  const [companySize, setCompanySize] = useState("1-10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, services_offered, coverage_area, company_size")
        .eq("id", user.id)
        .single();
      setRole(profile?.role || null);
      setServices(profile?.services_offered || []);
      setCoverageArea(profile?.coverage_area || "");
      setCompanySize(profile?.company_size || "1-10");
    }
    fetchProfile();
  }, []);

  const SERVICES = role === "vendor" ? VENDOR_SERVICES : BROKER_SERVICES;

  function toggleService(s) {
    setServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        services_offered: services,
        coverage_area: coverageArea,
        company_size: companySize,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
          <span>Step 1 of 1</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full mb-8">
          <div className="h-1.5 bg-blue-600 rounded-full w-full" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Company Details</h1>
        <p className="text-gray-400 text-sm mb-6">Tell carriers what you offer.</p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-white mb-2">Services Offered</label>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {SERVICES.map((s) => {
              const selected = services.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleService(s)}
                  className={`text-xs py-2.5 px-2 rounded-lg border transition text-left ${
                    selected
                      ? "border-blue-500 bg-blue-600/10 text-white font-medium"
                      : "border-slate-700 bg-slate-900 text-gray-300"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <label className="block text-sm font-semibold text-white mb-1">Coverage Area</label>
          <input
            required
            value={coverageArea}
            onChange={(e) => setCoverageArea(e.target.value)}
            placeholder="e.g. Southeast, Nationwide, TX & OK"
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
          />

          <label className="block text-sm font-semibold text-white mb-1">Company Size</label>
          <select
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 mb-8 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="1-10">1 - 10 employees</option>
            <option value="11-50">11 - 50 employees</option>
            <option value="51-200">51 - 200 employees</option>
            <option value="200+">200+ employees</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
