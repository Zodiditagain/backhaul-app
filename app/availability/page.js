"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, MapPin, Clock, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerSidebar from "../../components/TruckerSidebar";

// Pairs raw availability_log rows (one row per toggle: "available" then
// later "unavailable") into sessions a person can actually read — "Available
// near Atlanta, GA for 3h 40m, Aug 12 9:14am–12:54pm". `events` must be
// sorted ascending by created_at. A session with no closing "unavailable"
// row yet is still in progress (`end: null`) — either the trucker is
// currently marked available, or an edge case left one open (e.g. two
// "available" events back to back with no toggle-off between them, which
// the UI shouldn't produce but this defends against anyway).
function buildSessions(events) {
  const sessions = [];
  let open = null;
  events.forEach((e) => {
    if (e.event === "available") {
      if (open) sessions.push({ ...open, end: null });
      open = {
        start: e.created_at,
        location_label: e.location_label,
        location_lat: e.location_lat,
        location_lng: e.location_lng,
      };
    } else if (e.event === "unavailable" && open) {
      sessions.push({ ...open, end: e.created_at });
      open = null;
    }
  });
  if (open) sessions.push(open);
  return sessions.reverse();
}

function formatDuration(startIso, endIso) {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  const totalMins = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function AvailabilityHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);

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
        .select("company_name, role, is_admin")
        .eq("id", currentUser.id)
        .single();
      setProfile(profileData);

      const { data: logData, error } = await supabase
        .from("availability_log")
        .select("event, location_lat, location_lng, location_label, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: true });
      if (!error) {
        setSessions(buildSessions(logData || []));
      }

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
        <p className="text-slate-400 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading your availability history...
        </p>
      </div>
    );
  }

  return (
    <TruckerSidebar user={user} profile={profile} title="My Availability">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <History size={20} className="text-blue-400" />
          <h2 className="text-xl font-bold text-white">Availability history</h2>
        </div>
        <p className="text-sm text-slate-400 -mt-4">
          Every time you've toggled "I'm Available" on Overview, logged here as a session. This only
          tracks going forward from when this page was added — there's no earlier history to show.
        </p>

        {sessions.length === 0 ? (
          <div className="bg-[#111827] border border-white/10 rounded-xl p-8 text-center">
            <Clock size={22} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">
              No availability sessions yet. Toggle "I'm Available" on Overview to start tracking.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, i) => {
              const ongoing = !s.end;
              const sameDay = s.end && new Date(s.start).toDateString() === new Date(s.end).toDateString();
              return (
                <div
                  key={i}
                  className={`rounded-xl p-4 border flex items-center justify-between gap-3 flex-wrap ${
                    ongoing ? "bg-green-500/10 border-green-500/40" : "bg-[#111827] border-white/10"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <MapPin size={13} className="text-slate-500 shrink-0" />
                      <span className="text-sm font-semibold text-white truncate">
                        {s.location_label || "Unknown location"}
                      </span>
                      {ongoing && (
                        <span className="text-[10px] uppercase font-mono tracking-wide bg-green-500 text-white px-1.5 py-0.5 rounded shrink-0">
                          Ongoing
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDateTime(s.start)}
                      {" – "}
                      {ongoing ? "now" : sameDay ? formatTime(s.end) : formatDateTime(s.end)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-full px-2.5 py-1">
                      {formatDuration(s.start, s.end)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TruckerSidebar>
  );
}
