"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Users, FileText, Handshake, ArrowLeft, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const STATUS_LABELS = {
  draft: "Draft",
  sent: "Carrier Action Required",
  correction_requested: "Correction Requested",
  accepted: "Carrier Accepted",
  ready_for_pickup: "Ready for Pickup",
  signed_at_pickup: "Signed at Pickup",
  in_transit: "In Transit",
  delivered: "Delivered",
  receiver_signed: "Receiver Signed",
  completed: "Completed",
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [bols, setBols] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState(null);

  async function loadAll() {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setProfiles(profilesData || []);

    const { data: bolsData } = await supabase
      .from("bols")
      .select("*")
      .order("created_at", { ascending: false });
    setBols(bolsData || []);

    const { data: matchesData } = await supabase
      .from("matches")
      .select("*");
    setMatches(matchesData || []);
  }

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      setCurrentUserId(sessionData.session.user.id);
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", sessionData.session.user.id)
        .single();

      if (!myProfile?.is_admin) {
        router.replace("/dashboard");
        return;
      }
      setAuthorized(true);
      await loadAll();
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function toggleAdmin(profileId, currentValue) {
    if (profileId === currentUserId && currentValue) {
      const confirmed = window.confirm("This will remove your own admin access. Continue?");
      if (!confirmed) return;
    }
    setToggling(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ is_admin: !currentValue })
      .eq("id", profileId);
    if (!error) {
      setProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, is_admin: !currentValue } : p)));
    }
    setToggling(null);
  }

  if (loading) return <div className="p-8 text-steelgray">Loading admin console...</div>;
  if (!authorized) return null;

  const profileMap = {};
  profiles.forEach((p) => { profileMap[p.id] = p; });

  const truckerCount = profiles.filter((p) => p.role === "trucker").length;
  const brokerCount = profiles.filter((p) => p.role === "broker").length;
  const vendorCount = profiles.filter((p) => p.role === "vendor").length;
  const incompleteCount = profiles.filter((p) => !p.onboarding_completed).length;

  const statusCounts = {};
  bols.forEach((b) => {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  });

  const acceptedMatches = matches.filter((m) => m.status === "accepted").length;
  const pendingMatches = matches.filter((m) => m.status === "pending").length;

  const filteredProfiles = profiles.filter((p) =>
    (p.company_name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredBols = bols.filter((b) =>
    (b.bol_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (profileMap[b.broker_id]?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (profileMap[b.trucker_id]?.company_name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredAdminSearch = profiles.filter((p) =>
    (p.company_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-asphalt border-b-4 border-amberx">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rotate-45 bg-amberx flex items-center justify-center">
              <Shield className="-rotate-45" size={18} color="#1B1E21" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold leading-none">ADMIN CONSOLE</h1>
              <p className="text-gray-400 text-[11px] uppercase tracking-widest mt-0.5">Backhaul Back Office</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Users size={16} />} label="Truckers" value={truckerCount} />
          <StatCard icon={<Users size={16} />} label="Brokers" value={brokerCount} />
          <StatCard icon={<Users size={16} />} label="Vendors" value={vendorCount} />
          <StatCard icon={<Users size={16} />} label="Incomplete Profiles" value={incompleteCount} highlight={incompleteCount > 0} />
          <StatCard icon={<FileText size={16} />} label="Total BOLs" value={bols.length} />
          <StatCard icon={<FileText size={16} />} label="Completed BOLs" value={statusCounts.completed || 0} />
          <StatCard icon={<Handshake size={16} />} label="Accepted Matches" value={acceptedMatches} />
          <StatCard icon={<Handshake size={16} />} label="Pending Matches" value={pendingMatches} />
        </div>

        <div className="bg-white border border-gray-300 rounded-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-steelgray mb-3">BOLs by Status</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="bg-gray-50 border border-gray-200 rounded-sm px-3 py-1.5 text-xs">
                <span className="text-gray-400">{STATUS_LABELS[status] || status}:</span>{" "}
                <span className="font-bold text-asphalt">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-gray-300">
          <button
            onClick={() => { setTab("overview"); setSearch(""); }}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-wide border-b-2 ${tab === "overview" ? "border-amberx text-asphalt font-semibold" : "border-transparent text-gray-400"}`}
          >
            All BOLs
          </button>
          <button
            onClick={() => { setTab("users"); setSearch(""); }}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-wide border-b-2 ${tab === "users" ? "border-amberx text-asphalt font-semibold" : "border-transparent text-gray-400"}`}
          >
            All Users
          </button>
          <button
            onClick={() => { setTab("admins"); setSearch(""); }}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-wide border-b-2 ${tab === "admins" ? "border-amberx text-asphalt font-semibold" : "border-transparent text-gray-400"}`}
          >
            Manage Admins
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === "overview" ? "Search by BOL number or company..." : "Search by company name..."}
          className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
        />

        {tab === "overview" && (
          <div className="bg-white border border-gray-300 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">BOL #</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Broker</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Carrier</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Route</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Created</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredBols.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-mono">{b.bol_number}</td>
                    <td className="px-3 py-2">{profileMap[b.broker_id]?.company_name || "—"}</td>
                    <td className="px-3 py-2">{profileMap[b.trucker_id]?.company_name || "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {[b.shipper_city, b.shipper_state].filter(Boolean).join(", ") || "—"}
                      {" → "}
                      {[b.consignee_city, b.consignee_state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold">{STATUS_LABELS[b.status] || b.status}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard?openMatch=${b.match_id}`}
                        className="text-xs text-blue-600 underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredBols.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-400 italic">No BOLs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "users" && (
          <div className="bg-white border border-gray-300 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Company</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Role</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Onboarding</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Joined</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-semibold">
                      {p.company_name}
                      {p.is_admin && <span className="ml-1.5 text-[10px] bg-amberx text-asphalt px-1.5 py-0.5 rounded-sm font-mono">ADMIN</span>}
                    </td>
                    <td className="px-3 py-2 capitalize text-xs">{p.role}</td>
                    <td className="px-3 py-2 text-xs">
                      {p.onboarding_completed ? (
                        <span className="text-highway">Complete</span>
                      ) : (
                        <span className="text-alertred">Incomplete</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <Link href={`/company/${p.id}`} className="text-xs text-blue-600 underline">
                        View Profile
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredProfiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400 italic">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "admins" && (
          <div className="bg-white border border-gray-300 rounded-sm overflow-x-auto">
            <div className="px-3 py-2.5 bg-amberx/10 border-b border-amberx/30 text-xs text-steelgray">
              Toggle admin access for any account. Admins can view all users, BOLs, and matches across the platform.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Company</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Role</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Admin Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAdminSearch.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-semibold">
                      {p.company_name}
                      {p.id === currentUserId && <span className="ml-1.5 text-[10px] text-gray-400 font-mono">(you)</span>}
                    </td>
                    <td className="px-3 py-2 capitalize text-xs">{p.role}</td>
                    <td className="px-3 py-2 text-xs">
                      {p.is_admin ? (
                        <span className="text-highway font-semibold flex items-center gap-1"><ShieldCheck size={13} /> Admin</span>
                      ) : (
                        <span className="text-gray-400 flex items-center gap-1"><ShieldOff size={13} /> Not admin</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleAdmin(p.id, p.is_admin)}
                        disabled={toggling === p.id}
                        className={`text-[11px] uppercase tracking-wide rounded-sm px-2.5 py-1.5 font-mono disabled:opacity-50 ${
                          p.is_admin
                            ? "border border-alertred text-alertred hover:bg-alertred/10"
                            : "bg-asphalt text-white hover:bg-black"
                        }`}
                      >
                        {toggling === p.id ? "..." : p.is_admin ? "Revoke Admin" : "Grant Admin"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAdminSearch.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-400 italic">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div className={`rounded-sm p-4 flex flex-col gap-2 ${highlight && value > 0 ? "bg-alertred" : "bg-asphalt"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-gray-300 font-mono">{label}</span>
        <div className={`w-6 h-6 rotate-45 flex items-center justify-center ${highlight && value > 0 ? "bg-white" : "bg-amberx"}`}>
          <span className={`-rotate-45 ${highlight && value > 0 ? "text-alertred" : "text-asphalt"}`}>{icon}</span>
        </div>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  );
}
