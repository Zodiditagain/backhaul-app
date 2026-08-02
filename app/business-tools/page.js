"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign, Fuel } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export default function BusinessTools() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const currentUser = sessionData.session.user;
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

  if (loading) return <div className="p-8 text-steelgray">Loading...</div>;
  if (!profile) return <div className="p-8 text-alertred">Couldn't load your profile. Try logging in again.</div>;

  return (
    <div className="min-h-screen">
      <header className="bg-asphalt border-b-4 border-amberx">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide">
              <ArrowLeft size={14} /> Dashboard
            </Link>
          </div>
          <h1 className="text-white text-lg font-bold uppercase tracking-widest">Business Tools</h1>
          <div className="w-24" />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-8">
        <p className="text-gray-400 text-sm mb-6 font-mono uppercase tracking-wide">
          Quick calculators to help you price loads and estimate costs.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link
            href="/business-tools/load-rate"
            className="bg-asphalt border-2 border-gray-700 hover:border-amberx rounded-lg p-6 flex flex-col gap-3 transition-colors"
          >
            <div className="w-12 h-12 rotate-45 bg-amberx flex items-center justify-center">
              <DollarSign className="-rotate-45" size={22} color="#1B1E21" />
            </div>
            <h2 className="text-white text-lg font-bold">Load Rate Calculator</h2>
            <p className="text-gray-400 text-sm">
              Figure out your rate per mile and check it against your target margin before you accept a load.
            </p>
          </Link>
          <Link
            href="/business-tools/fuel-cost"
            className="bg-asphalt border-2 border-gray-700 hover:border-amberx rounded-lg p-6 flex flex-col gap-3 transition-colors"
          >
            <div className="w-12 h-12 rotate-45 bg-amberx flex items-center justify-center">
              <Fuel className="-rotate-45" size={22} color="#1B1E21" />
            </div>
            <h2 className="text-white text-lg font-bold">Fuel Cost Calculator</h2>
            <p className="text-gray-400 text-sm">
              Estimate fuel cost for a trip based on miles, MPG, deadhead, and current fuel price.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
