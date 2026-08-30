"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy, Loader2, CheckCircle2, RotateCcw, Sparkles, Bell, BellOff } from "lucide-react";
import { supabase, authHeaders } from "../../../lib/supabaseClient";

// Plays a short two-tone alert entirely with the Web Audio API — no sound
// file to host or load, just two quick beeps synthesized on the spot.
function playAlertSound(audioCtxRef) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    [880, 660].forEach((freq, i) => {
      const start = now + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    // sound is a bonus, never worth breaking the page over
  }
}

export default function AdminSupportPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("open");

  // Per-request reply drafts, keyed by request id — lets an admin reply
  // into a ticket's thread independent of the separate resolve/reopen
  // action below.
  const [replyDrafts, setReplyDrafts] = useState({});
  const [sendingReplyId, setSendingReplyId] = useState(null);
  const [replyErrors, setReplyErrors] = useState({});

  // Sound alerts default off — browsers block audio until there's been a
  // real click on the page, so this starts muted and the Bell button below
  // is what both turns it on AND satisfies that click requirement at the
  // same time. Remembered across visits via localStorage.
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem("backhaul_admin_support_sound") === "on");
  }, []);

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem("backhaul_admin_support_sound", next ? "on" : "off");
      // Creating/resuming the AudioContext here, inside a real click
      // handler, is what lets later sounds play without the browser
      // silently blocking them.
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (next && AudioCtx) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
        if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
        playAlertSound(audioCtxRef);
      }
      return next;
    });
  }

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    const headers = await authHeaders();
    const res = await fetch("/api/admin/support", { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load support requests.");
      setLoading(false);
      return;
    }
    setRequests(data.requests || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Live updates: Supabase Realtime pushes new support requests and new
  // customer follow-up messages the instant they're inserted, so this page
  // doesn't need a manual reload to notice them.
  useEffect(() => {
    const channel = supabase
      .channel("admin-support-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_requests" },
        () => {
          if (soundEnabledRef.current) playAlertSound(audioCtxRef);
          loadRequests();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          if (payload.new?.sender_role === "user") {
            if (soundEnabledRef.current) playAlertSound(audioCtxRef);
            loadRequests();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(id, action) {
    setBusyId(id);
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    await fetch("/api/admin/support/" + id, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action }),
    });
    await loadRequests();
    setBusyId(null);
  }

  async function sendReply(requestId) {
    const text = (replyDrafts[requestId] || "").trim();
    if (!text) return;
    setSendingReplyId(requestId);
    setReplyErrors((prev) => ({ ...prev, [requestId]: "" }));
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const res = await fetch(`/api/admin/support/${requestId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    setSendingReplyId(null);
    if (!res.ok) {
      setReplyErrors((prev) => ({ ...prev, [requestId]: data.error || "Couldn't send that reply." }));
      return;
    }
    setReplyDrafts((prev) => ({ ...prev, [requestId]: "" }));
    loadRequests();
  }

  const filtered = requests.filter((r) => statusFilter === "all" || r.status === statusFilter);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-4"
        >
          <ArrowLeft size={14} />
          Back to Admin
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <LifeBuoy size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Support Requests</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          Priority requests (from Broker/Vendor accounts) are sorted to the top automatically.
        </p>

        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            {["open", "resolved", "all"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
                  statusFilter === s
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleSound}
            title={
              soundEnabled
                ? "Sound alerts on — click to mute"
                : "Click to enable a sound alert for new support requests"
            }
            className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
              soundEnabled
                ? "bg-green-500/15 border-green-500/40 text-green-400"
                : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            {soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
            Sound Alerts {soundEnabled ? "On" : "Off"}
          </button>
        </div>

        {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

        <div className="space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </p>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-8 text-center">
              <LifeBuoy size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No {statusFilter !== "all" ? statusFilter : ""} support requests.</p>
            </div>
          ) : (
            filtered.map((r) => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-md px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {r.priority && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500 text-amber-400">
                          Priority
                        </span>
                      )}
                      {r.ai_responded && (
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500 text-blue-400">
                          <Sparkles size={10} /> AI Replied
                        </span>
                      )}
                      <p className="text-sm font-semibold text-white">{r.subject}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.requester?.company_name || "Unknown"} ({r.requester?.role || "?"})
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5 max-w-2xl">{r.message}</p>
                    {r.ai_responded && r.ai_reply && (
                      <div className="mt-2 bg-slate-950 border border-blue-900/40 rounded-md p-2.5 max-w-2xl">
                        <p className="text-[10px] uppercase tracking-wide text-blue-400 font-semibold mb-1">
                          What the AI sent
                        </p>
                        <p className="text-xs text-gray-300 whitespace-pre-line">{r.ai_reply}</p>
                      </div>
                    )}
                    {(r.support_messages || []).map((m) => (
                      <div
                        key={m.id}
                        className={
                          "mt-2 rounded-md p-2.5 max-w-2xl border " +
                          (m.sender_role === "admin"
                            ? "bg-slate-950 border-blue-900/40"
                            : "bg-slate-950 border-slate-800")
                        }
                      >
                        <p
                          className={
                            "text-[10px] uppercase tracking-wide font-semibold mb-1 " +
                            (m.sender_role === "admin" ? "text-blue-400" : "text-gray-500")
                          }
                        >
                          {m.sender_role === "admin" ? "Staff reply" : "Customer follow-up"}
                        </p>
                        <p className="text-xs text-gray-300 whitespace-pre-line">{m.body}</p>
                      </div>
                    ))}
                    <div className="mt-2.5 max-w-2xl">
                      <textarea
                        value={replyDrafts[r.id] || ""}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        rows={2}
                        placeholder="Reply to this request..."
                        className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-md py-2 px-2.5 focus:outline-none focus:border-amber-500"
                      />
                      {replyErrors[r.id] && <p className="text-[11px] text-red-400 mt-1">{replyErrors[r.id]}</p>}
                      <div className="flex justify-end mt-1.5">
                        <button
                          type="button"
                          onClick={() => sendReply(r.id)}
                          disabled={sendingReplyId === r.id || !(replyDrafts[r.id] || "").trim()}
                          className="text-[11px] font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
                        >
                          {sendingReplyId === r.id ? "Sending..." : "Send Reply"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === "resolved" ? (
                      <button
                        onClick={() => setStatus(r.id, "reopen")}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-md border border-slate-700 bg-slate-800 text-gray-400 hover:text-white disabled:opacity-50"
                      >
                        <RotateCcw size={11} /> Reopen
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(r.id, "resolve")}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-md border border-green-500/40 bg-green-500/15 text-green-400 disabled:opacity-50"
                      >
                        <CheckCircle2 size={11} /> Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
