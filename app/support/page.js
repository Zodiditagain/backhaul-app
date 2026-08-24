"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LifeBuoy, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export default function SupportPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userId, setUserId] = useState(null);
  const [isPriority, setIsPriority] = useState(false);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

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
    setUserId(user.id);
    // Broker/vendor accounts get their support requests flagged as priority
    // for now — once real billing exists, this should check active
    // subscription status instead of just role.
    setIsPriority(profile?.role === "broker" || profile?.role === "vendor");
    setCheckingAccess(false);
  }

  const loadRequests = useCallback(async () => {
    if (!userId) return;
    setLoadingRequests(true);
    const { data } = await supabase
      .from("support_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setRequests(data || []);
    setLoadingRequests(false);
  }, [userId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function submit(e) {
    e.preventDefault();
    setSubmitError("");
    if (!subject.trim() || !message.trim()) {
      setSubmitError("Please fill in both a subject and a message.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("support_requests").insert({
      user_id: userId,
      subject: subject.trim(),
      message: message.trim(),
      priority: isPriority,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    setSubject("");
    setMessage("");
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 5000);
    loadRequests();
  }

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Checking your access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-4"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <LifeBuoy size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Support</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6">
          {isPriority
            ? "As a Broker/Vendor account, your requests are flagged for priority review."
            : "Send us a message and we'll get back to you as soon as we can."}
        </p>

        <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-md p-4 mb-8 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What do you need help with?"
              className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Give us as much detail as you can."
              className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-amber-500"
            />
          </div>
          {submitError && <p className="text-xs text-red-400">{submitError}</p>}
          {submitSuccess && (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Request sent — we'll be in touch soon.
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-semibold uppercase tracking-wide px-4 py-2.5 rounded-md"
          >
            {submitting ? "Sending..." : "Send Request"}
          </button>
        </form>

        <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-3">Your Requests</h2>
        <div className="space-y-2">
          {loadingRequests ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </p>
          ) : requests.length === 0 ? (
            <p className="text-gray-600 text-xs">You haven't sent any support requests yet.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-md px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{r.subject}</p>
                  <span
                    className={
                      "text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-md border shrink-0 " +
                      (r.status === "resolved"
                        ? "bg-green-500/15 border-green-500/40 text-green-400"
                        : "bg-slate-800 border-slate-700 text-gray-400")
                    }
                  >
                    {r.status === "resolved" ? "Resolved" : "Open"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{r.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
