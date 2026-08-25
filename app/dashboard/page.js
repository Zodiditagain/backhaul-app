"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import BrokerOverview from "../../components/BrokerOverview";
import TruckerOverview from "../../components/TruckerOverview";
import Sidebar from "../../components/Sidebar";
import TruckerSidebar from "../../components/TruckerSidebar";
import WelcomeModal from "../../components/WelcomeModal";
export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
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

  // Truckers get the redesigned dark "carrier network" shell (TruckerSidebar
  // + TruckerOverview, which does its own internal data fetching — including
  // Safety Tip of the Day and the latest blog post — mirroring the
  // self-contained pattern BrokerOverview already established). Brokers and
  // vendors keep the existing light Sidebar + BrokerOverview untouched.
  if (isTrucker) {
    return (
      <TruckerSidebar user={user} profile={profile} title="Overview">
        <div className="max-w-6xl mx-auto">
          <TruckerOverview user={user} />
        </div>
        <div className="max-w-6xl mx-auto py-6 flex items-center justify-center gap-3 text-xs text-slate-600">
          <Link href="/privacy" target="_blank" className="hover:text-blue-400 underline">
            Privacy Policy
          </Link>
          <span>·</span>
          <Link href="/terms" target="_blank" className="hover:text-blue-400 underline">
            Terms of Service
          </Link>
        </div>
      </TruckerSidebar>
    );
  }

  return (
    <Sidebar user={user} profile={profile} title="Overview">
      <BrokerOverview user={user} role={profile.role} />
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
