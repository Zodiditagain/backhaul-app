"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Star, Bell, Users, MessageSquare, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

async function countRows(table, filters) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  Object.entries(filters).forEach(([col, val]) => {
    query = query.eq(col, val);
  });
  const { count } = await query;
  return count || 0;
}

export default function BrokerAnalyticsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    savedCarriers: 0,
    activeAlerts: 0,
    totalMatches: 0,
    messagesSent: 0,
    bolsCreated: 0,
    bolsCompleted: 0,
  });

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
    setUserId(user.id);
    setCheckingAccess(false);
  }

  const loadStats = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [savedCarriers, activeAlerts, totalMatches, messagesSent, bolsCreated, bolsCompleted] = await Promise.all([
      countRows("saved_carriers", { partner_id: userId }),
      countRows("capacity_alerts", { broker_id: userId, active: true }),
      countRows("matches", { partner_id: userId }),
      countRows("messages", { sender_id: userId }),
      countRows("bols", { broker_id: userId }),
      countRows("bols", { broker_id: userId, status: "completed" }),
    ]);
    setStats({ savedCarriers, activeAlerts, totalMatches, messagesSent, bolsCreated, bolsCompleted });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Checking your access...</p>
      </div>
    );
  }

  const cards = [
    { label: "Saved Carriers", value: stats.savedCarriers, icon: Star, color: "text-amber-400", href: "/broker/saved-carriers" },
    { label: "Active Capacity Alerts", value: stats.activeAlerts, icon: Bell, color: "text-blue-400", href: "/broker/capacity-alerts" },
    { label: "Total Connections", value: stats.totalMatches, icon: Users, color: "text-green-400" },
    { label: "Messages Sent", value: stats.messagesSent, icon: MessageSquare, color: "text-purple-400" },
    { label: "BOLs Created", value: stats.bolsCreated, icon: FileText, color: "text-gray-300" },
    { label: "Loads Completed", value: stats.bolsCompleted, icon: CheckCircle2, color: "text-highway" },
  ];

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
          <BarChart3 size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Broker Analytics</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          A quick snapshot of your activity on Backhaul — how many carriers you're tracking, how much
          you're negotiating, and how many loads you've closed out.
        </p>

        {loading ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading your stats...
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cards.map((c) => {
              const Icon = c.icon;
              const content = (
                <div className="bg-slate-900 border border-slate-800 rounded-md p-4 h-full">
                  <Icon size={18} className={c.color + " mb-2"} />
                  <p className="text-2xl font-bold text-white">{c.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
                </div>
              );
              return c.href ? (
                <Link key={c.label} href={c.href} className="hover:border-amber-500/50 rounded-md transition">
                  {content}
                </Link>
              ) : (
                <div key={c.label}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
