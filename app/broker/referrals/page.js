"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gift, Copy, CheckCircle2, Truck, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

export default function ReferralsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userId, setUserId] = useState(null);
  const [referralLink, setReferralLink] = useState("");
  const [copied, setCopied] = useState(false);

  const [referred, setReferred] = useState([]);
  const [loading, setLoading] = useState(true);

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
    setReferralLink(window.location.origin + "/signup?ref=" + user.id);
    setCheckingAccess(false);
  }

  const loadReferred = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, company_name, role, created_at")
      .eq("referred_by", userId)
      .order("created_at", { ascending: false });
    setReferred(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadReferred();
  }, [loadReferred]);

  function copyLink() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
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
          <Gift size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Referrals</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          Share your link with other brokers, vendors, or carriers. We're tracking every signup that
          comes through it — rewards for referrals are coming soon.
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-md p-4 mb-8">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Your referral link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={referralLink}
              className="flex-1 bg-slate-950 border border-slate-800 text-white text-xs rounded-md py-2.5 px-3"
            />
            <button
              onClick={copyLink}
              className="shrink-0 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2.5 rounded-md"
            >
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-3">
          Signed up through your link ({referred.length})
        </h2>
        <div className="space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </p>
          ) : referred.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-8 text-center">
              <Truck size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No one has signed up through your link yet.</p>
            </div>
          ) : (
            referred.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-md px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">{r.company_name}</p>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">{r.role}</p>
                </div>
                <p className="text-[11px] text-gray-500">
                  {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
