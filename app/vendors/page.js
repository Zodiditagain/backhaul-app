"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Store, MapPin, Phone, Globe, Loader2 } from "lucide-react";
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

const SERVICE_AREA_LABELS = {
  local: "Local",
  regional: "Regional",
  multi_state: "Multiple States",
  nationwide: "Nationwide",
};

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function VendorDirectoryPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState(null);
  const [stateFilter, setStateFilter] = useState("");

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
    // Truckers browse the vendor directory for free. Brokers and vendors get
    // it as part of the paid Partner Pro bundle, so they need an active or
    // trialing subscription to get past this page.
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "broker" || profile?.role === "vendor") {
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
    }
    setCheckingAccess(false);
  }

  const loadVendors = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, company_name, vendor_categories, service_area, city, state, remote_service, phone, website, about")
      .eq("role", "vendor");
    setVendors(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (checkingAccess) return;
    loadVendors();
  }, [checkingAccess, loadVendors]);

  const filteredVendors = vendors
    .filter((v) => !categoryFilter || (v.vendor_categories || []).includes(categoryFilter))
    .filter((v) => !stateFilter || v.remote_service || v.state === stateFilter)
    .sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));

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
          <Store size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Vendor Directory</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          Browse factoring companies, fuel and truck stop providers, insurance, repair shops, and other
          trucking services on Backhaul. Filter by category and state to find what you need.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
              !categoryFilter
                ? "bg-amber-600 border-amber-600 text-white"
                : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            All Categories
          </button>
          {VENDOR_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
                categoryFilter === c.id
                  ? "bg-amber-600 border-amber-600 text-white"
                  : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6">
          <label className="text-xs text-gray-400">
            State:{" "}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-white text-xs rounded-md py-1.5 px-2 ml-1"
            >
              <option value="">All States</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          {stateFilter && (
            <span className="text-[11px] text-gray-500">
              Showing {stateFilter} vendors plus any nationwide/remote providers.
            </span>
          )}
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading vendors...
            </p>
          ) : filteredVendors.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-8 text-center">
              <Store size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No vendors match these filters yet.</p>
              <p className="text-gray-600 text-xs mt-1">Try clearing a filter.</p>
            </div>
          ) : (
            filteredVendors.map((v) => (
              <Link
                key={v.id}
                href={"/company/" + v.id}
                className="block bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-md px-4 py-3 transition"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{v.company_name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={10} />
                      {v.remote_service
                        ? "Nationwide / Remote"
                        : [v.city, v.state].filter(Boolean).join(", ") || "Location not listed"}
                      {v.service_area && ` — ${SERVICE_AREA_LABELS[v.service_area] || v.service_area}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {(v.vendor_categories || []).map((c) => (
                        <span
                          key={c}
                          className="text-[10px] uppercase tracking-wide text-gray-500 bg-slate-800 rounded px-1.5 py-0.5"
                        >
                          {VENDOR_CATEGORIES.find((o) => o.id === c)?.label || c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1 text-[11px] text-gray-500">
                    {v.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} /> {v.phone}
                      </span>
                    )}
                    {v.website && (
                      <span className="flex items-center gap-1">
                        <Globe size={10} /> {v.website}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
