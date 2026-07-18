"use client";

import { useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const VENDOR_CATEGORIES = [
  { id: "factoring", label: "Factoring Company" },
  { id: "fuel", label: "Fuel / Truck Stop Provider" },
  { id: "insurance", label: "Commercial Insurance" },
  { id: "repair", label: "Truck Repair / Maintenance" },
  { id: "roadside", label: "Roadside Assistance" },
  { id: "dealer", label: "Truck or Trailer Dealer" },
  { id: "rental", label: "Equipment Rental / Leasing" },
  { id: "eld", label: "ELD / Technology Provider" },
  { id: "compliance", label: "Compliance / Permit Service" },
  { id: "parking", label: "Truck Parking / Warehousing" },
  { id: "accounting", label: "Accounting / Tax Service" },
  { id: "legal", label: "Legal Service" },
  { id: "staffing", label: "Recruiting / Staffing" },
  { id: "other", label: "Other Trucking Service" },
];

// Categories with a dedicated Step 3 question set
const DETAILED_CATEGORIES = ["factoring", "fuel", "insurance", "repair"];

const FACTORING_SERVICES = [
  "Recourse factoring",
  "Non-recourse factoring",
  "Same-day funding",
  "Fuel advances",
  "Broker credit checks",
  "Collections assistance",
];

const FUEL_SERVICES = [
  "Diesel",
  "DEF",
  "Fuel cards",
  "Fuel discounts",
  "Truck parking",
  "Reserved parking",
  "Showers",
  "Food",
  "Truck maintenance",
  "Tire service",
  "Weigh station",
  "Roadside assistance",
];

const INSURANCE_PRODUCTS = [
  "Primary liability",
  "Cargo insurance",
  "Physical damage",
  "General liability",
  "Bobtail",
  "Non-trucking liability",
  "Occupational accident",
];

const REPAIR_SERVICES = [
  "Diesel repair",
  "Mobile mechanic",
  "Tire repair",
  "Towing",
  "Trailer repair",
  "Preventive maintenance",
  "Emergency roadside service",
];

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [role, setRole] = useState("trucker");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Vendor wizard state
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);
  const [vendorCategories, setVendorCategories] = useState([]);
  const [vendorDetails, setVendorDetails] = useState({});
  const [serviceArea, setServiceArea] = useState("local");
  const [businessAddress, setBusinessAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [remoteService, setRemoteService] = useState(false);
  const [about, setAbout] = useState("");

  function toggleVendorCategory(id) {
    setVendorCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function updateVendorDetail(category, key, value) {
    setVendorDetails((prev) => ({
      ...prev,
      [category]: { ...(prev[category] || {}), [key]: value },
    }));
  }

  function toggleVendorDetailArray(category, key, value) {
    setVendorDetails((prev) => {
      const current = prev[category]?.[key] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [category]: { ...(prev[category] || {}), [key]: updated } };
    });
  }

  // Step 1 submit — handles trucker/broker (full signup) and vendor (account creation only)
  async function handleStep1Submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Something went wrong creating your account.");
      setLoading(false);
      return;
    }

    if (role !== "vendor") {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: data.user.id, role, company_name: companyName });
      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
      setLoading(false);
      setDone(true);
      return;
    }

    // Vendor: create a minimal profile row now, fill in the rest across the wizard
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      role: "vendor",
      company_name: companyName,
      phone,
      website: website || null,
    });
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setUserId(data.user.id);
    setLoading(false);
    setStep(2);
  }

  function handleStep2Continue() {
    setError("");
    if (vendorCategories.length === 0) {
      setError("Select at least one vendor category to continue.");
      return;
    }
    const hasDetailedCategory = vendorCategories.some((c) => DETAILED_CATEGORIES.includes(c));
    setStep(hasDetailedCategory ? 3 : 4);
  }

  async function handleFinalSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        vendor_categories: vendorCategories,
        vendor_details: vendorDetails,
        service_area: serviceArea,
        business_address: businessAddress || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        remote_service: remoteService,
        about: about || null,
        onboarding_completed: true,
      })
      .eq("id", userId);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-gray-300 text-sm">
            We sent a confirmation link to <strong>{email}</strong>. Click it, then come back and log in.
          </p>
          <Link href="/login" className="inline-block mt-4 text-blue-400 underline text-sm">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const isVendor = role === "vendor";
  const totalVendorSteps = 4;

  return (
    <div className="min-h-screen relative flex flex-col items-center px-6 py-10 text-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1600&q=70')",
        }}
      />
      <div className="absolute inset-0 bg-slate-950/85" />

      <div className="relative z-10 flex flex-col items-center w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rotate-45 bg-blue-600 flex items-center justify-center rounded-md">
            <Truck className="-rotate-45" size={22} color="#ffffff" />
          </div>
          <div className="text-left">
            <p className="text-white font-bold tracking-wide leading-tight">BACKHAUL</p>
            <p className="text-blue-400 text-xs tracking-widest">NETWORK</p>
          </div>
        </div>

        <div className="w-full max-w-sm text-left">
          {isVendor && step > 1 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2 text-center">
                Step {step} of {totalVendorSteps}
              </p>
              <div className="w-full h-1.5 bg-slate-800 rounded-full">
                <div
                  className="h-1.5 bg-blue-600 rounded-full transition-all"
                  style={{ width: `${(step / totalVendorSteps) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 1 — Account */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit}>
              <h1 className="text-2xl font-bold text-white mb-1 text-center">
                {isVendor ? "Create a Vendor Account" : "Create an account"}
              </h1>
              <p className="text-gray-300 text-sm mb-6 text-center">
                {isVendor
                  ? "Connect your services with trucking companies and freight brokers."
                  : "Join the network connecting carriers, brokers, and vendors."}
              </p>

              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">I am a...</label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { id: "trucker", label: "Trucking Co." },
                  { id: "broker", label: "Broker" },
                  { id: "vendor", label: "Vendor" },
                ].map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`text-xs py-2 rounded-sm border transition ${
                      role === r.id
                        ? "bg-blue-600 border-blue-600 text-white font-semibold"
                        : "border-slate-700 text-gray-300 bg-slate-900/60"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Company name</label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter legal company name"
                className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
              />

              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">
                {isVendor ? "Business email" : "Email"}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isVendor ? "Enter company email" : ""}
                className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
              />

              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
              />

              {isVendor && (
                <>
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Phone number</label>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter business phone"
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
                  />

                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Website — optional</label>
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="Enter website address"
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </>
              )}

              {role !== "trucker" && !isVendor && (
                <p className="text-xs text-gray-400 mb-3 italic">
                  Broker accounts will need a subscription to unlock full access once billing is added.
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition disabled:opacity-50"
              >
                {loading ? "Creating account..." : isVendor ? "Continue to Vendor Profile" : "Sign up"}
              </button>

              <p className="text-sm text-gray-400 mt-4 text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-400 underline">Log in</Link>
              </p>
            </form>
          )}

          {/* STEP 2 — Vendor category */}
          {step === 2 && (
            <div>
              <h1 className="text-2xl font-bold text-white mb-1 text-center">What type of vendor are you?</h1>
              <p className="text-gray-300 text-sm mb-6 text-center">
                Select all services your company provides.
              </p>

              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

              <div className="grid grid-cols-1 gap-2 mb-6">
                {VENDOR_CATEGORIES.map((c) => {
                  const selected = vendorCategories.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggleVendorCategory(c.id)}
                      className={`text-sm py-2.5 px-3 rounded-sm border text-left transition ${
                        selected
                          ? "bg-blue-600 border-blue-600 text-white font-semibold"
                          : "border-slate-700 text-gray-300 bg-slate-900/60"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleStep2Continue}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition"
              >
                Continue
              </button>
            </div>
          )}

          {/* STEP 3 — Category-specific services */}
          {step === 3 && (
            <div>
              <h1 className="text-2xl font-bold text-white mb-1 text-center">Tell us more about your services</h1>
              <p className="text-gray-300 text-sm mb-6 text-center">
                This helps carriers and brokers find exactly what they need.
              </p>

              {vendorCategories.includes("factoring") && (
                <div className="mb-6 pb-6 border-b border-slate-800">
                  <h2 className="text-sm font-bold text-white mb-3">Factoring services</h2>
                  <p className="text-xs text-gray-400 mb-2">What factoring services do you provide?</p>
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {FACTORING_SERVICES.map((s) => {
                      const selected = (vendorDetails.factoring?.services || []).includes(s);
                      return (
                        <button
                          type="button"
                          key={s}
                          onClick={() => toggleVendorDetailArray("factoring", "services", s)}
                          className={`text-xs py-2 px-3 rounded-sm border text-left transition ${
                            selected
                              ? "bg-blue-600 border-blue-600 text-white font-semibold"
                              : "border-slate-700 text-gray-300 bg-slate-900/60"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Starting factoring rate — optional</label>
                  <input
                    value={vendorDetails.factoring?.startingRate || ""}
                    onChange={(e) => updateVendorDetail("factoring", "startingRate", e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Funding time</label>
                  <select
                    value={vendorDetails.factoring?.fundingTime || ""}
                    onChange={(e) => updateVendorDetail("factoring", "fundingTime", e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    <option value="same_day">Same day</option>
                    <option value="24_hours">24 hours</option>
                    <option value="48_hours">48 hours</option>
                  </select>
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Contract required?</label>
                  <select
                    value={vendorDetails.factoring?.contractRequired || ""}
                    onChange={(e) => updateVendorDetail("factoring", "contractRequired", e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="both">Both options</option>
                  </select>
                </div>
              )}

              {vendorCategories.includes("fuel") && (
                <div className="mb-6 pb-6 border-b border-slate-800">
                  <h2 className="text-sm font-bold text-white mb-3">Fuel / truck stop services</h2>
                  <p className="text-xs text-gray-400 mb-2">Which services do your locations provide?</p>
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {FUEL_SERVICES.map((s) => {
                      const selected = (vendorDetails.fuel?.services || []).includes(s);
                      return (
                        <button
                          type="button"
                          key={s}
                          onClick={() => toggleVendorDetailArray("fuel", "services", s)}
                          className={`text-xs py-2 px-3 rounded-sm border text-left transition ${
                            selected
                              ? "bg-blue-600 border-blue-600 text-white font-semibold"
                              : "border-slate-700 text-gray-300 bg-slate-900/60"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Number of locations</label>
                  <input
                    type="number"
                    value={vendorDetails.fuel?.numLocations || ""}
                    onChange={(e) => updateVendorDetail("fuel", "numLocations", e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 italic mt-2">
                    You'll be able to add individual locations from your dashboard after signup.
                  </p>
                </div>
              )}

              {vendorCategories.includes("insurance") && (
                <div className="mb-6 pb-6 border-b border-slate-800">
                  <h2 className="text-sm font-bold text-white mb-3">Insurance products</h2>
                  <p className="text-xs text-gray-400 mb-2">Insurance products offered</p>
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {INSURANCE_PRODUCTS.map((s) => {
                      const selected = (vendorDetails.insurance?.products || []).includes(s);
                      return (
                        <button
                          type="button"
                          key={s}
                          onClick={() => toggleVendorDetailArray("insurance", "products", s)}
                          className={`text-xs py-2 px-3 rounded-sm border text-left transition ${
                            selected
                              ? "bg-blue-600 border-blue-600 text-white font-semibold"
                              : "border-slate-700 text-gray-300 bg-slate-900/60"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">States licensed in</label>
                  <input
                    value={vendorDetails.insurance?.statesLicensed || ""}
                    onChange={(e) => updateVendorDetail("insurance", "statesLicensed", e.target.value)}
                    placeholder="e.g. FL, GA, TX"
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Minimum fleet size</label>
                  <select
                    value={vendorDetails.insurance?.minFleetSize || ""}
                    onChange={(e) => updateVendorDetail("insurance", "minFleetSize", e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    <option value="owner_operator">Owner-operator</option>
                    <option value="2-10">2 – 10 trucks</option>
                    <option value="10+">10+ trucks</option>
                  </select>
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Quote turnaround time</label>
                  <select
                    value={vendorDetails.insurance?.quoteTurnaround || ""}
                    onChange={(e) => updateVendorDetail("insurance", "quoteTurnaround", e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    <option value="same_day">Same day</option>
                    <option value="24_hours">24 hours</option>
                    <option value="2-3_days">2 - 3 days</option>
                  </select>
                </div>
              )}

              {vendorCategories.includes("repair") && (
                <div className="mb-6 pb-6 border-b border-slate-800">
                  <h2 className="text-sm font-bold text-white mb-3">Repair services</h2>
                  <p className="text-xs text-gray-400 mb-2">Services offered</p>
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {REPAIR_SERVICES.map((s) => {
                      const selected = (vendorDetails.repair?.services || []).includes(s);
                      return (
                        <button
                          type="button"
                          key={s}
                          onClick={() => toggleVendorDetailArray("repair", "services", s)}
                          className={`text-xs py-2 px-3 rounded-sm border text-left transition ${
                            selected
                              ? "bg-blue-600 border-blue-600 text-white font-semibold"
                              : "border-slate-700 text-gray-300 bg-slate-900/60"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Service radius (miles)</label>
                  <input
                    type="number"
                    value={vendorDetails.repair?.serviceRadius || ""}
                    onChange={(e) => updateVendorDetail("repair", "serviceRadius", e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">24-hour service?</label>
                  <select
                    value={vendorDetails.repair?.twentyFourHour || ""}
                    onChange={(e) => updateVendorDetail("repair", "twentyFourHour", e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition"
              >
                Continue
              </button>
            </div>
          )}

          {/* STEP 4 — Service area, address, about */}
          {step === 4 && (
            <form onSubmit={handleFinalSubmit}>
              <h1 className="text-2xl font-bold text-white mb-1 text-center">Service area & profile</h1>
              <p className="text-gray-300 text-sm mb-6 text-center">Almost done.</p>

              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Service area</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { id: "local", label: "Local" },
                  { id: "regional", label: "Regional" },
                  { id: "multi_state", label: "Multiple States" },
                  { id: "nationwide", label: "Nationwide" },
                ].map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setServiceArea(s.id)}
                    className={`text-xs py-2.5 rounded-sm border transition ${
                      serviceArea === s.id
                        ? "bg-blue-600 border-blue-600 text-white font-semibold"
                        : "border-slate-700 text-gray-300 bg-slate-900/60"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 mb-4 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={remoteService}
                  onChange={(e) => setRemoteService(e.target.checked)}
                  className="rounded border-slate-700"
                />
                We provide services nationwide or remotely
              </label>

              {!remoteService && (
                <>
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Business address</label>
                  <input
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="Street address"
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="col-span-1 bg-slate-900/70 border border-slate-700 rounded-sm px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="col-span-1 bg-slate-900/70 border border-slate-700 rounded-sm px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">State</option>
                      {STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="ZIP"
                      className="col-span-1 bg-slate-900/70 border border-slate-700 rounded-sm px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">About your company</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value.slice(0, 500))}
                placeholder="Briefly explain your services and what makes your company different"
                rows={4}
                className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-1 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mb-4 text-right">{about.length}/500</p>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition disabled:opacity-50"
              >
                {loading ? "Saving..." : "Finish setting up"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
