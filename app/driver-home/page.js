"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, LogOut } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

// Deliberately the only page a driver account ever lands on. Drivers have
// no access to matches, messages, brokers, or vendors — this page exists
// purely to confirm who's logged in and which company they're with. If
// that ever changes (e.g. giving drivers their own Route Map access),
// this is the natural place to add it.
export default function DriverHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, company_name, driver_full_name")
        .eq("id", user.id)
        .single();

      if (profileData?.role !== "driver") {
        // Not a driver account — this page isn't for them.
        router.replace("/dashboard");
        return;
      }
      setProfile(profileData);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rotate-45 bg-blue-600 flex items-center justify-center rounded-lg mx-auto mb-6">
          <Truck className="-rotate-45" size={26} color="#ffffff" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">
          {profile.driver_full_name || "Welcome"}
        </h1>
        <p className="text-blue-400 text-sm mb-6">Driving for {profile.company_name}</p>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-gray-400 mb-6">
          This account is set up for identification purposes. It doesn&apos;t have access to loads,
          messages, or broker/vendor information — that stays with your company&apos;s main account.
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 justify-center w-full bg-slate-800 hover:bg-slate-700 text-gray-300 text-sm font-medium py-2.5 rounded-md border border-slate-700"
        >
          <LogOut size={15} /> Log out
        </button>
      </div>
    </div>
  );
}
