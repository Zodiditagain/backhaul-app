"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Gift, Copy, CheckCircle2, Truck, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerSidebar from "../../components/TruckerSidebar";

// Trucker-facing referrals — same referred_by mechanism app/broker/referrals
// already uses (any signup via /signup?ref=<user id> stores that id on the
// new profile's referred_by column, regardless of role). Unlike the broker
// version, this page has no Partner Pro subscription gate — there's no
// equivalent paid product on the trucker side, so referring is free here.
export default function ReferralsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [referralLink, setReferralLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [referred, setReferred] = useState([]);
  const [loadingReferred, setLoadingReferred] = useState(true);

  const loadReferred = useCallback(async (userId) => {
    setLoadingReferred(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, company_name, role, created_at")
      .eq("referred_by", userId)
      .order("created_at", { ascending: false });
    setReferred(data || []);
    setLoadingReferred(false);
  }, []);

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
      setReferralLink(window.location.origin + "/signup?ref=" + currentUser.id);

      await loadReferred(currentUser.id);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadReferred]);

  function copyLink() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
        <p className="text-slate-400 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading your referrals...
        </p>
      </div>
    );
  }

  return (
    <TruckerSidebar user={user} profile={profile} title="Referrals">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Gift size={20} className="text-blue-400" />
          <h2 className="text-xl font-bold text-white">Referrals</h2>
        </div>
        <p className="text-sm text-slate-400 -mt-4">
          Share your link with other carriers, brokers, or vendors. We're tracking every signup that
          comes through it — rewards for referrals are coming soon.
        </p>

        <div className="bg-[#111827] border border-white/10 rounded-xl p-4">
          <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1.5">Your referral link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={referralLink}
              className="flex-1 bg-[#0b1220] border border-white/10 text-white text-xs rounded-md py-2.5 px-3"
            />
            <button
              onClick={copyLink}
              className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2.5 rounded-md"
            >
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">
            Signed up through your link ({referred.length})
          </h3>
          <div className="space-y-2">
            {loadingReferred ? (
              <p className="text-slate-500 text-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </p>
            ) : referred.length === 0 ? (
              <div className="bg-[#111827] border border-white/10 rounded-xl p-8 text-center">
                <Truck size={22} className="text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No one has signed up through your link yet.</p>
              </div>
            ) : (
              referred.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-[#111827] border border-white/10 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{r.company_name}</p>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide">{r.role}</p>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </TruckerSidebar>
  );
}
