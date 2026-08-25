"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Loader2, Handshake, Fuel } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "../../components/Sidebar";

export default function MessagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [lastMessages, setLastMessages] = useState({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.replace("/login");
      return;
    }
    const currentUser = sessionData.session.user;
    setUser(currentUser);
    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
    setProfile(profileData);
    const isTrucker = profileData?.role === "trucker";

    const { data: matchData } = await supabase
      .from("matches")
      .select(
        isTrucker
          ? "id, status, created_at, trucker_last_read_at, partner_role, partner_id, partner:profiles!matches_partner_id_fkey(company_name)"
          : "id, status, created_at, partner_role, trucker_id, trucker:profiles!matches_trucker_id_fkey(company_name)"
      )
      .eq(isTrucker ? "trucker_id" : "partner_id", currentUser.id)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });
    const list = matchData || [];
    setMatches(list);

    if (list.length > 0) {
      const { data: msgData } = await supabase
        .from("messages")
        .select("match_id, sender_id, text, rate, created_at")
        .in(
          "match_id",
          list.map((m) => m.id)
        )
        .order("created_at", { ascending: false });
      const latest = {};
      (msgData || []).forEach((m) => {
        if (!latest[m.match_id]) latest[m.match_id] = m;
      });
      setLastMessages(latest);
    }
    setLoading(false);
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading messages...
        </p>
      </div>
    );
  }

  const isTrucker = profile.role === "trucker";

  return (
    <Sidebar user={user} profile={profile} title="Messages">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare size={20} className="text-cyan-600" />
          <h2 className="text-xl font-bold text-slate-900">Conversations</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Every accepted connection lands here. Open one to negotiate a rate and manage the load.
        </p>
        <div className="space-y-2">
          {matches.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
              <MessageSquare size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No conversations yet.</p>
              {!isTrucker && (
                <Link
                  href="/broker/search-carriers"
                  className="inline-block mt-3 text-xs font-semibold text-cyan-600 hover:text-cyan-700 underline"
                >
                  Search carriers to get started
                </Link>
              )}
            </div>
          ) : (
            matches.map((m) => {
              const other = isTrucker ? m.partner : m.trucker;
              const lastMsg = lastMessages[m.id];
              const unread =
                isTrucker &&
                lastMsg &&
                lastMsg.sender_id !== user.id &&
                (!m.trucker_last_read_at || new Date(lastMsg.created_at) > new Date(m.trucker_last_read_at));
              return (
                <Link
                  key={m.id}
                  href={`/dashboard?openMatch=${m.id}`}
                  className="flex items-center justify-between bg-white border border-slate-200 hover:border-cyan-400 rounded-lg px-4 py-3 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      {m.partner_role === "vendor" ? (
                        <Fuel size={15} className="text-slate-500" />
                      ) : (
                        <Handshake size={15} className="text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${unread ? "font-bold text-slate-900" : "font-medium text-slate-800"}`}>
                        {other?.company_name || "Unknown"}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {lastMsg ? lastMsg.text || (lastMsg.rate ? `Offer: $${lastMsg.rate}/mi` : "No messages yet") : "No messages yet"}
                      </p>
                    </div>
                  </div>
                  {unread && <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />}
                </Link>
              );
            })
          )}
        </div>
      </div>
    </Sidebar>
  );
}
