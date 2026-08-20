"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Users, FileText, Handshake, ArrowLeft, ShieldCheck, ShieldOff, MessageSquare, Camera, Ban, CheckCircle2, Activity, KeyRound, Bell, Mail, Flag } from "lucide-react";
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

const ROLE_DISPLAY = {
  trucker: "Carrier",
  broker: "Broker",
  vendor: "Vendor",
  admin: "Admin",
};

const EVENT_TYPE_OPTIONS = ["login", "bol", "load", "message", "subscription", "admin", "security"];
const USER_TYPE_OPTIONS = ["trucker", "broker", "vendor", "admin"];
const STATUS_OPTIONS = ["success", "warning", "failed"];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [bols, setBols] = useState([]);
  const [matches, setMatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState(null);
  const [suspending, setSuspending] = useState(null);
  const [resettingPw, setResettingPw] = useState(null);
  const [resetMessage, setResetMessage] = useState("");
  const [reminding, setReminding] = useState(null);
  const [remindedIds, setRemindedIds] = useState([]);

  const [auditDateRange, setAuditDateRange] = useState("week");
  const [auditUserType, setAuditUserType] = useState("all");
  const [auditEventType, setAuditEventType] = useState("all");
  const [auditStatus, setAuditStatus] = useState("all");

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
      .select("*")
      .order("created_at", { ascending: false });
    setMatches(matchesData || []);

    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setMessages(messagesData || []);

    const { data: auditData } = await supabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setAuditEvents(auditData || []);
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

  async function toggleSuspended(profileId, currentValue) {
    if (profileId === currentUserId) {
      window.alert("You can't suspend your own account.");
      return;
    }
    const action = currentValue ? "unsuspend" : "suspend";
    const confirmed = window.confirm(`Are you sure you want to ${action} this account?`);
    if (!confirmed) return;
    setSuspending(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ is_suspended: !currentValue })
      .eq("id", profileId);
    if (!error) {
      setProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, is_suspended: !currentValue } : p)));
    }
    setSuspending(null);
  }

  async function resetPassword(profileId, companyName) {
    setResetMessage("");
    setResettingPw(profileId);
    const { data: email, error: emailError } = await supabase.rpc("get_user_email", { p_user_id: profileId });
    if (emailError || !email) {
      setResetMessage(`Could not find an email for ${companyName}.`);
      setResettingPw(null);
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) {
      setResetMessage(`Failed to send reset email: ${resetError.message}`);
    } else {
      setResetMessage(`Password reset email sent to ${companyName}.`);
      await supabase.from("audit_events").insert({
        actor_id: currentUserId,
        actor_role: "admin",
        company_name: companyName,
        event_type: "admin",
        action: "Sent Password Reset",
        status: "success",
        target_user_id: profileId,
      });
    }
    setResettingPw(null);
  }

  async function sendProfileReminder(profileId, companyName) {
    setReminding(profileId);
    const { error } = await supabase.from("notifications").insert({
      user_id: profileId,
      match_id: null,
      bol_id: null,
      title: "Complete your profile",
      message: "Finish setting up your profile so brokers, vendors, and carriers can find and match with you on Backhaul.",
    });
    if (!error) {
      setRemindedIds((prev) => [...prev, profileId]);
      await supabase.from("audit_events").insert({
        actor_id: currentUserId,
        actor_role: "admin",
        company_name: companyName,
        event_type: "admin",
        action: "Sent Profile Reminder",
        status: "success",
        target_user_id: profileId,
      });
    }
    setReminding(null);
  }

  if (loading) return <div className="p-8 text-steelgray">Loading admin console...</div>;
  if (!authorized) return null;

  const profileMap = {};
  profiles.forEach((p) => { profileMap[p.id] = p; });

  const truckerCount = profiles.filter((p) => p.role === "trucker").length;
  const brokerCount = profiles.filter((p) => p.role === "broker").length;
  const vendorCount = profiles.filter((p) => p.role === "vendor").length;
  const incompleteCount = profiles.filter((p) => !p.onboarding_completed).length;
  const suspendedCount = profiles.filter((p) => p.is_suspended).length;

  const statusCounts = {};
  bols.forEach((b) => {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  });

  const acceptedMatches = matches.filter((m) => m.status === "accepted").length;
  const pendingMatches = matches.filter((m) => m.status === "pending").length;

  const bolsWithPod = bols.filter((b) => b.pod_url);

  function filterAndSortByRole(roleName) {
    return profiles
      .filter((p) => p.role === roleName && (p.company_name || "").toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));
  }
  const truckerProfiles = filterAndSortByRole("trucker");
  const brokerProfiles = filterAndSortByRole("broker");
  const vendorProfiles = filterAndSortByRole("vendor");

  const filteredBols = bols.filter((b) =>
    (b.bol_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (profileMap[b.broker_id]?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (profileMap[b.trucker_id]?.company_name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredAdminSearch = profiles.filter((p) =>
    (p.company_name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredMatches = matches.filter((m) =>
    (profileMap[m.broker_id]?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (profileMap[m.trucker_id]?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (profileMap[m.vendor_id]?.company_name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredMessages = messages.filter((m) =>
    (m.text || "").toLowerCase().includes(search.toLowerCase()) ||
    (profileMap[m.sender_id]?.company_name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredPods = bolsWithPod.filter((b) =>
    (b.bol_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (profileMap[b.trucker_id]?.company_name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredSuspended = profiles.filter((p) =>
    p.is_suspended && (p.company_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const now = new Date();
  const auditCutoff = new Date(now);
  if (auditDateRange === "today") {
    auditCutoff.setHours(0, 0, 0, 0);
  } else if (auditDateRange === "week") {
    auditCutoff.setDate(auditCutoff.getDate() - 7);
  } else if (auditDateRange === "month") {
    auditCutoff.setDate(auditCutoff.getDate() - 30);
  } else {
    auditCutoff.setFullYear(2000);
  }

  const filteredAuditEvents = auditEvents.filter((e) => {
    if (new Date(e.created_at) < auditCutoff) return false;
    if (auditUserType !== "all" && e.actor_role !== auditUserType) return false;
    if (auditEventType !== "all" && e.event_type !== auditEventType) return false;
    if (auditStatus !== "all" && e.status !== auditStatus) return false;
    if (search && !(
      (e.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.action || "").toLowerCase().includes(search.toLowerCase())
    )) return false;
    return true;
  });

  const searchPlaceholders = {
    overview: "Search by BOL number or company...",
    users: "Search by company name...",
    admins: "Search by company name...",
    matches: "Search by broker, carrier, or vendor company...",
    messages: "Search message text or sender...",
    pods: "Search by BOL number or carrier...",
    suspended: "Search suspended accounts...",
    audit: "Search by company or action...",
  };
  const securityAlertCount = auditEvents.filter((e) => e.event_type === "security").length;

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
          <div className="flex items-center gap-4">
            <Link
              href="/admin/blog"
              className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
            >
              <FileText size={14} /> Blog Review
            </Link>
            <Link
              href="/admin/recruiting"
              className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
            >
              <Mail size={14} /> Recruiting
            </Link>
            <Link
              href="/admin/route-reports"
              className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
            >
              <Flag size={14} /> Route Reports
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
            >
              <ArrowLeft size={14} /> Back to Dashboard
            </Link>
          </div>
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
          <StatCard icon={<Camera size={16} />} label="PODs Uploaded" value={bolsWithPod.length} />
          <StatCard icon={<Ban size={16} />} label="Suspended Accounts" value={suspendedCount} highlight={suspendedCount > 0} />
          <StatCard icon={<Activity size={16} />} label="Audit Events Logged" value={auditEvents.length} />
          <StatCard icon={<Activity size={16} />} label="Security Alerts" value={securityAlertCount} highlight={securityAlertCount > 0} />
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

        <div className="flex items-center gap-2 border-b border-gray-300 flex-wrap">
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
            onClick={() => { setTab("matches"); setSearch(""); }}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-wide border-b-2 ${tab === "matches" ? "border-amberx text-asphalt font-semibold" : "border-transparent text-gray-400"}`}
          >
            All Matches
          </button>
          <button
            onClick={() => { setTab("messages"); setSearch(""); }}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-wide border-b-2 ${tab === "messages" ? "border-amberx text-asphalt font-semibold" : "border-transparent text-gray-400"}`}
          >
            Messages
          </button>
          <button
            onClick={() => { setTab("pods"); setSearch(""); }}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-wide border-b-2 ${tab === "pods" ? "border-amberx text-asphalt font-semibold" : "border-transparent text-gray-400"}`}
          >
            PODs
          </button>
          <button
            onClick={() => { setTab("suspended"); setSearch(""); }}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-wide border-b-2 ${tab === "suspended" ? "border-amberx text-asphalt font-semibold" : "border-transparent text-gray-400"}`}
          >
            Suspended
          </button>
          <button
            onClick={() => { setTab("audit"); setSearch(""); }}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-wide border-b-2 ${tab === "audit" ? "border-amberx text-asphalt font-semibold" : "border-transparent text-gray-400"}`}
          >
            Audit Events
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
          placeholder={searchPlaceholders[tab]}
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
                      <Link href={`/dashboard?openMatch=${b.match_id}`} className="text-xs text-blue-600 underline">Open</Link>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UserColumn
              title="Truckers"
              profiles={truckerProfiles}
              onSendReminder={sendProfileReminder}
              reminding={reminding}
              remindedIds={remindedIds}
            />
            <UserColumn
              title="Brokers"
              profiles={brokerProfiles}
              onSendReminder={sendProfileReminder}
              reminding={reminding}
              remindedIds={remindedIds}
            />
            <UserColumn
              title="Vendors"
              profiles={vendorProfiles}
              onSendReminder={sendProfileReminder}
              reminding={reminding}
              remindedIds={remindedIds}
            />
          </div>
        )}

        {tab === "matches" && (
          <div className="bg-white border border-gray-300 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Broker</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Carrier</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Vendor</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="px-3 py-2">{profileMap[m.broker_id]?.company_name || "—"}</td>
                    <td className="px-3 py-2">{profileMap[m.trucker_id]?.company_name || "—"}</td>
                    <td className="px-3 py-2">{profileMap[m.vendor_id]?.company_name || "—"}</td>
                    <td className="px-3 py-2 text-xs font-semibold capitalize">{m.status}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filteredMatches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400 italic">No matches found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "messages" && (
          <div className="bg-white border border-gray-300 rounded-sm overflow-x-auto">
            <div className="px-3 py-2.5 bg-amberx/10 border-b border-amberx/30 text-xs text-steelgray flex items-center gap-1.5">
              <MessageSquare size={13} /> Showing the 200 most recent messages platform-wide.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Sender</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Message</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Rate</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Sent</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMessages.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-semibold">{profileMap[m.sender_id]?.company_name || "—"}</td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate">{m.text}</td>
                    <td className="px-3 py-2 text-xs">{m.rate ? `$${m.rate}` : "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard?openMatch=${m.match_id}`} className="text-xs text-blue-600 underline">Open thread</Link>
                    </td>
                  </tr>
                ))}
                {filteredMessages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400 italic">No messages found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "pods" && (
          <div className="bg-white border border-gray-300 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">BOL #</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Carrier</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Delivered</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">POD Uploaded</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPods.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-mono">{b.bol_number}</td>
                    <td className="px-3 py-2">{profileMap[b.trucker_id]?.company_name || "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{b.delivered_at ? new Date(b.delivered_at).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{b.pod_uploaded_at ? new Date(b.pod_uploaded_at).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2"><a href={b.pod_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">View POD</a></td>
                  </tr>
                ))}
                {filteredPods.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400 italic">No PODs uploaded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "suspended" && (
          <div className="bg-white border border-gray-300 rounded-sm overflow-x-auto">
            <div className="px-3 py-2.5 bg-alertred/10 border-b border-alertred/30 text-xs text-steelgray">
              Accounts suspended from the platform.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Company</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Role</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSuspended.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-semibold">{p.company_name}</td>
                    <td className="px-3 py-2 capitalize text-xs">{p.role}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleSuspended(p.id, p.is_suspended)}
                        disabled={suspending === p.id}
                        className="text-[11px] uppercase tracking-wide rounded-sm px-2.5 py-1.5 font-mono disabled:opacity-50 bg-asphalt text-white hover:bg-black flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} /> {suspending === p.id ? "..." : "Unsuspend"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSuspended.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-400 italic">No suspended accounts.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "audit" && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-300 rounded-sm p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wide block mb-1">Date range</label>
                <select
                  value={auditDateRange}
                  onChange={(e) => setAuditDateRange(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                >
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wide block mb-1">User type</label>
                <select
                  value={auditUserType}
                  onChange={(e) => setAuditUserType(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                >
                  <option value="all">All</option>
                  {USER_TYPE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{ROLE_DISPLAY[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wide block mb-1">Event type</label>
                <select
                  value={auditEventType}
                  onChange={(e) => setAuditEventType(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                >
                  <option value="all">All</option>
                  {EVENT_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wide block mb-1">Status</label>
                <select
                  value={auditStatus}
                  onChange={(e) => setAuditStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                >
                  <option value="all">All</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white border border-gray-300 rounded-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Date & Time</th>
                    <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">User</th>
                    <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Company</th>
                    <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Action</th>
                    <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditEvents.map((e) => (
                    <tr key={e.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs">{ROLE_DISPLAY[e.actor_role] || e.actor_role || (e.metadata?.email ? "Unknown" : "—")}</td>
                      <td className="px-3 py-2 text-xs">{e.company_name || e.metadata?.email || "—"}</td>
                      <td className="px-3 py-2 text-xs font-semibold">{e.action}</td>
                      <td className="px-3 py-2 text-xs">
                        {e.status === "success" && <span className="text-highway font-semibold">Success</span>}
                        {e.status === "warning" && <span className="text-amberx font-semibold">Warning</span>}
                        {e.status === "failed" && <span className="text-alertred font-semibold">Failed</span>}
                      </td>
                    </tr>
                  ))}
                  {filteredAuditEvents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-400 italic">No audit events found for this filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "admins" && (
          <div className="bg-white border border-gray-300 rounded-sm overflow-x-auto">
            <div className="px-3 py-2.5 bg-amberx/10 border-b border-amberx/30 text-xs text-steelgray">
              Toggle admin access, suspend accounts, or reset a password here.
            </div>
            {resetMessage && (
              <div className="px-3 py-2.5 bg-blue-50 border-b border-blue-200 text-xs text-blue-800">
                {resetMessage}
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Company</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Role</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Admin Status</th>
                  <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-gray-400">Account Status</th>
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2"></th>
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
                    <td className="px-3 py-2 text-xs">
                      {p.is_suspended ? (
                        <span className="text-alertred font-semibold">Suspended</span>
                      ) : (
                        <span className="text-highway">Active</span>
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
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleSuspended(p.id, p.is_suspended)}
                        disabled={suspending === p.id || p.id === currentUserId}
                        className={`text-[11px] uppercase tracking-wide rounded-sm px-2.5 py-1.5 font-mono disabled:opacity-50 ${
                          p.is_suspended
                            ? "border border-highway text-highway hover:bg-highway/10"
                            : "border border-alertred text-alertred hover:bg-alertred/10"
                        }`}
                      >
                        {suspending === p.id ? "..." : p.is_suspended ? "Unsuspend" : "Suspend"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => resetPassword(p.id, p.company_name)}
                        disabled={resettingPw === p.id}
                        className="text-[11px] uppercase tracking-wide rounded-sm px-2.5 py-1.5 font-mono disabled:opacity-50 border border-blue-600 text-blue-600 hover:bg-blue-50 flex items-center gap-1"
                      >
                        <KeyRound size={12} /> {resettingPw === p.id ? "..." : "Reset Password"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAdminSearch.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-400 italic">No users found.</td>
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

function UserColumn({ title, profiles, onSendReminder, reminding, remindedIds }) {
  return (
    <div className="bg-white border border-gray-300 rounded-sm overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-steelgray">
          {title} <span className="text-gray-400 font-normal">({profiles.length})</span>
        </h3>
      </div>
      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {profiles.map((p) => (
          <div key={p.id} className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate">{p.company_name}</span>
              <Link href={`/company/${p.id}`} className="text-[11px] text-blue-600 underline shrink-0">View</Link>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {p.is_admin && <span className="text-[9px] bg-amberx text-asphalt px-1.5 py-0.5 rounded-sm font-mono">ADMIN</span>}
              {p.is_suspended && <span className="text-[9px] bg-alertred text-white px-1.5 py-0.5 rounded-sm font-mono">SUSPENDED</span>}
              {p.onboarding_completed ? (
                <span className="text-[10px] text-highway">Complete</span>
              ) : (
                <span className="text-[10px] text-alertred">Incomplete</span>
              )}
              <span className="text-[10px] text-gray-400">— {new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            {!p.onboarding_completed && (
              <button
                onClick={() => onSendReminder(p.id, p.company_name)}
                disabled={reminding === p.id || remindedIds.includes(p.id)}
                className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wide rounded-sm px-2 py-1 font-mono border border-amberx text-amberx hover:bg-amberx/10 disabled:opacity-50 disabled:cursor-default"
              >
                <Bell size={11} />
                {remindedIds.includes(p.id) ? "Reminder Sent" : reminding === p.id ? "Sending..." : "Send Reminder"}
              </button>
            )}
          </div>
        ))}
        {profiles.length === 0 && (
          <p className="px-3 py-6 text-center text-gray-400 italic text-xs">No {title.toLowerCase()} found.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  const isHighlighted = highlight && value > 0;
  return (
    <div
      className="rounded-sm p-4 flex flex-col gap-2"
      style={{ backgroundColor: isHighlighted ? "#DC2626" : "#1B1E21" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-gray-300 font-mono">{label}</span>
        <div className={`w-6 h-6 rotate-45 flex items-center justify-center ${isHighlighted ? "bg-white" : "bg-amberx"}`}>
          <span className={`-rotate-45 ${isHighlighted ? "text-alertred" : "text-asphalt"}`}>{icon}</span>
        </div>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  );
}
