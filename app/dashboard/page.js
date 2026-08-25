"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerDashboard from "../../components/TruckerDashboard";
import BrokerOverview from "../../components/BrokerOverview";
import Sidebar from "../../components/Sidebar";
import WelcomeModal from "../../components/WelcomeModal";
export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [latestPost, setLatestPost] = useState(null);
  const [tipOfDay, setTipOfDay] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const currentUser = sessionData.session.user;
      setUser(currentUser);
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();
      if (error) {
        console.error(error);
      } else {
        setProfile(profileData);
        // One-time "what you get for $199/month" modal for broker/vendor
        // accounts — welcome_seen flips true the first time they dismiss it,
        // so it never shows again on later logins.
        const isPartnerAccount = profileData?.role === "broker" || profileData?.role === "vendor";
        if (isPartnerAccount && !profileData?.welcome_seen) {
          setShowWelcome(true);
        }
      }
      // Safety Tip of the Day (trucker-only here — the broker/vendor version
      // of this is rendered inside BrokerOverview itself now, styled to
      // match the new "navy-and-cyan" look).
      const { data: tipsData } = await supabase
        .from("safety_tips")
        .select("title, body")
        .in("audience", ["all", "trucker"])
        .order("sort_order", { ascending: true });
      if (tipsData && tipsData.length > 0) {
        const startOfYear = new Date(new Date().getFullYear(), 0, 0);
        const dayOfYear = Math.floor((new Date() - startOfYear) / 86400000);
        setTipOfDay(tipsData[dayOfYear % tipsData.length]);
      }
      // Row Level Security on blog_posts only returns posts that are live
      // (published, or their scheduled auto-publish time has passed) — a
      // pending draft never reaches this query, so nothing unreviewed can
      // show up here.
      const { data: postData } = await supabase
        .from("blog_posts")
        .select("slug, title, headline_stat, published_at, scheduled_publish_at")
        .order("scheduled_publish_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLatestPost(postData || null);
      setLoading(false);
    }
    load();
  }, [router]);
  async function handleCloseWelcome() {
    setShowWelcome(false);
    if (user) {
      await supabase.from("profiles").update({ welcome_seen: true }).eq("id", user.id);
    }
  }
  if (loading) return <div className="p-8 text-slate-500">Loading...</div>;
  if (!profile) return <div className="p-8 text-red-500">Couldn't load your profile. Try logging in again.</div>;

  const isTrucker = profile.role === "trucker";

  return (
    <Sidebar user={user} profile={profile} title="Overview">
      {isTrucker ? (
        <div className="max-w-4xl mx-auto">
          {tipOfDay && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck size={14} className="text-cyan-600" />
                <p className="text-cyan-700 text-[10px] uppercase tracking-widest font-semibold">Safety Tip of the Day</p>
              </div>
              <p className="text-slate-900 font-semibold text-sm mb-1">{tipOfDay.title}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{tipOfDay.body}</p>
            </div>
          )}
          {latestPost && (
            <Link
              href={`/blog/${latestPost.slug}`}
              className="block bg-white border border-slate-200 hover:border-cyan-300 rounded-lg p-4 mb-6 transition"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-cyan-700 text-[10px] uppercase tracking-widest font-semibold mb-1">
                    From the Backhaul Blog
                  </p>
                  <p className="text-slate-900 font-semibold text-sm mb-1.5 truncate">{latestPost.title}</p>
                  {latestPost.headline_stat?.value && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-slate-900">{latestPost.headline_stat.value}</span>
                      {latestPost.headline_stat.delta && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono border rounded-full px-2 py-0.5 ${
                            latestPost.headline_stat.direction === "good"
                              ? "bg-green-500/15 text-green-600 border-green-500/40"
                              : latestPost.headline_stat.direction === "bad"
                              ? "bg-red-500/15 text-red-600 border-red-500/40"
                              : "bg-blue-500/15 text-blue-600 border-blue-500/40"
                          }`}
                        >
                          <span>
                            {latestPost.headline_stat.direction === "good"
                              ? "▲"
                              : latestPost.headline_stat.direction === "bad"
                              ? "▼"
                              : "•"}
                          </span>
                          {latestPost.headline_stat.delta}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide bg-cyan-600 text-white px-3 py-2 rounded-md">
                  Read More
                </span>
              </div>
            </Link>
          )}
          <TruckerDashboard user={user} />
        </div>
      ) : (
        <BrokerOverview user={user} role={profile.role} />
      )}
      <div className="max-w-4xl mx-auto py-6 flex items-center justify-center gap-3 text-xs text-slate-400">
        <Link href="/privacy" target="_blank" className="hover:text-cyan-600 underline">
          Privacy Policy
        </Link>
        <span>·</span>
        <Link href="/terms" target="_blank" className="hover:text-cyan-600 underline">
          Terms of Service
        </Link>
      </div>
      {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}
    </Sidebar>
  );
}
