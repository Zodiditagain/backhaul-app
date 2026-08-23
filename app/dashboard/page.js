"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck, LogOut, Settings, Shield, Calculator, Map, Activity, Newspaper, ShieldCheck, Search, Star, Bell } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerDashboard from "../../components/TruckerDashboard";
import MatchmakingDashboard from "../../components/MatchmakingDashboard";
import NotificationBell from "../../components/NotificationBell";
export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [latestPost, setLatestPost] = useState(null);
  const [tipOfDay, setTipOfDay] = useState(null);
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
      }
      // Safety Tip of the Day: a fixed, pre-written library (not AI-generated
      // day to day — see safety_tips table) rotated deterministically by
      // day-of-year, filtered to tips tagged "all" plus whichever audience
      // matches this user's role. Same tip shows all day, changes daily,
      // no server-side scheduling needed.
      const audienceBucket =
        profileData?.role === "trucker"
          ? "trucker"
          : profileData?.role === "broker" || profileData?.role === "vendor"
          ? "broker_vendor"
          : null;
      const { data: tipsData } = await supabase
        .from("safety_tips")
        .select("title, body")
        .in("audience", audienceBucket ? ["all", audienceBucket] : ["all"])
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
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }
  if (loading) return <div className="p-8 text-steelgray">Loading...</div>;
  if (!profile) return <div className="p-8 text-alertred">Couldn't load your profile. Try logging in again.</div>;
  const isPartner = profile.role === "broker" || profile.role === "vendor";
  const isTrucker = profile.role === "trucker";
  return (
    <div className="min-h-screen">
      <header className="bg-asphalt border-b-4 border-amberx">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rotate-45 bg-amberx flex items-center justify-center">
              <Truck className="-rotate-45" size={18} color="#1B1E21" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold leading-none">BACKHAUL</h1>
              <p className="text-gray-400 text-[11px] uppercase tracking-widest mt-0.5">{profile.company_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <NotificationBell user={user} />
            {profile.is_admin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-mono uppercase tracking-wide px-2.5 py-1.5 rounded-sm"
              >
                <Shield size={14} /> Admin
              </Link>
            )}
            {isTrucker && (
              <Link
                href="/route-map"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Map size={14} /> Route Map
              </Link>
            )}
            {isTrucker && (
              <Link
                href="/market-pulse"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Activity size={14} /> Market Pulse
              </Link>
            )}
            {(isTrucker || isPartner) && (
              <Link
                href="/business-tools"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Calculator size={14} /> Business Tools
              </Link>
            )}
            {isPartner && (
              <Link
                href="/available-trucks"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Truck size={14} /> Available Trucks
              </Link>
            )}
            {isPartner && (
              <Link
                href="/broker/search-carriers"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Search size={14} /> Search Carriers
              </Link>
            )}
            {isPartner && (
              <Link
                href="/broker/saved-carriers"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Star size={14} /> Saved Carriers
              </Link>
            )}
            {isPartner && (
              <Link
                href="/broker/capacity-alerts"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Bell size={14} /> Capacity Alerts
              </Link>
            )}
            {isPartner && (
              <Link
                href="/onboarding-partner"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Settings size={14} /> Edit Profile
              </Link>
            )}
            <Link
              href="/blog"
              className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
            >
              <Newspaper size={14} /> Blog
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-6">
        {tipOfDay && (
          <div className="bg-asphalt border border-highway/30 rounded-sm p-4 mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck size={14} className="text-highway" />
              <p className="text-highway text-[10px] uppercase tracking-widest font-mono">Safety Tip of the Day</p>
            </div>
            <p className="text-white font-semibold text-sm mb-1">{tipOfDay.title}</p>
            <p className="text-gray-400 text-xs leading-relaxed">{tipOfDay.body}</p>
          </div>
        )}
        {latestPost && (
          <Link
            href={`/blog/${latestPost.slug}`}
            className="block bg-asphalt border border-amberx/30 hover:border-amberx rounded-sm p-4 mb-6 transition"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-amberx text-[10px] uppercase tracking-widest font-mono mb-1">
                  From the Backhaul Blog
                </p>
                <p className="text-white font-semibold text-sm mb-1.5 truncate">{latestPost.title}</p>
                {latestPost.headline_stat?.value && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-white">{latestPost.headline_stat.value}</span>
                    {latestPost.headline_stat.delta && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono border rounded-full px-2 py-0.5 ${
                          latestPost.headline_stat.direction === "good"
                            ? "bg-green-500/15 text-green-400 border-green-500/40"
                            : latestPost.headline_stat.direction === "bad"
                            ? "bg-red-500/15 text-red-400 border-red-500/40"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/40"
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
              <span className="shrink-0 text-xs font-mono uppercase tracking-wide bg-amberx text-asphalt px-3 py-2 rounded-sm">
                Read More
              </span>
            </div>
          </Link>
        )}
        {profile.role === "trucker" ? (
          <TruckerDashboard user={user} />
        ) : (
          <MatchmakingDashboard user={user} role={profile.role} />
        )}
      </main>
      <footer className="max-w-4xl mx-auto px-5 py-6 flex items-center justify-center gap-3 text-xs text-gray-400">
        <Link href="/privacy" target="_blank" className="hover:text-amberx underline">
          Privacy Policy
        </Link>
        <span className="text-gray-300">·</span>
        <Link href="/terms" target="_blank" className="hover:text-amberx underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
