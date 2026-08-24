"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Store, CheckCircle2 } from "lucide-react";
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

// Categories with a dedicated detail-question set — same set as the signup wizard
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

export default function VendorProfilePage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [vendorCategories, setVendorCategories] = useState([]);
  const [vendorDetails, setVendorDetails] = useState({});
  const [serviceArea, setServiceArea] = useState("local");
  const [businessAddress, setBusinessAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [remoteService, setRemoteService] = useState(false);
  const [about, setAbout] = useState("");

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
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "role, company_name, phone, website, vendor_categories, vendor_details, service_area, business_address, city, state, zip, remote_service, about"
      )
      .eq("id", user.id)
      .single();
    if (profile?.role !== "vendor") {
      router.push("/dashboard");
      return;
    }
    setUserId(user.id);
    setCompanyName(profile.company_name || "");
    setPhone(profile.phone || "");
    setWebsite(profile.website || "");
    setVendorCategories(profile.vendor_categories || []);
    setVendorDetails(profile.vendor_details || {});
    setServiceArea(profile.service_area || "local");
    setBusinessAddress(profile.business_address || "");
    setCity(profile.city || "");
    setState(profile.state || "");
    setZip(profile.zip || "");
    setRemoteService(!!profile.remote_service);
    setAbout(profile.about || "");
    setCheckingAccess(false);
    setLoading(false);
  }

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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (vendorCategories.length === 0) {
      setError("Select at least one vendor category.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        company_name: companyName,
        phone,
        website: website || null,
        vendor_categories: vendorCategories,
        vendor_details: vendorDetails,
        service_area: serviceArea,
        business_address: businessAddress || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        remote_service: remoteService,
        about: about || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  if (checkingAccess || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-md mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-4"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <Store size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Vendor Profile</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6">
          This is what carriers and brokers see about your business in the Vendor Directory and on your
          public profile. Update it any time.
        </p>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {saved && (
          <p className="text-green-400 text-sm mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Profile saved.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Company name</label>
          <input
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
          />

          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Phone number</label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
          />

          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Website — optional</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-6 text-sm text-white focus:outline-none focus:border-blue-500"
          />

          <label className="block text-sm font-bold text-white mb-2">Vendor Categories</label>
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

          {vendorCategories.includes("factoring") && (
            <div className="mb-6 pb-6 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white mb-3">Factoring services</h2>
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
            </div>
          )}

          {vendorCategories.includes("insurance") && (
            <div className="mb-6 pb-6 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white mb-3">Insurance products</h2>
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
                className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select...</option>
                <option value="owner_operator">Owner-operator</option>
                <option value="2-10">2 – 10 trucks</option>
                <option value="10+">10+ trucks</option>
              </select>
            </div>
          )}

          {vendorCategories.includes("repair") && (
            <div className="mb-6 pb-6 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white mb-3">Repair services</h2>
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
                className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

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
            rows={4}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-1 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mb-4 text-right">{about.length}/500</p>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
