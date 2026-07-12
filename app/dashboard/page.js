"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck, LogOut, Settings } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerDashboard from "../../components/TruckerDashboard";
import MatchmakingDashboard from "../../components/MatchmakingDashboard";
export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
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
            {isPartner && (
              <Link
                href="/onboarding-partner"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Settings size={14} /> Edit Profile
              </Link>
            )}
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
        {profile.role === "trucker" ? (
          <TruckerDashboard user={user} />
        ) : (
          <MatchmakingDashboard user={user} role={profile.role} />
        )}
      </main>
    </div>
  );
}
