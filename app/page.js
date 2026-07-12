"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck, MapPin } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

 useEffect(() => {
  supabase.auth.getSession().then(async ({ data }) => {
    if (data.session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, onboarding_completed")
        .eq("id", data.session.user.id)
        .single();

      if (profile?.role === "trucker" && !profile.onboarding_completed) {
        router.replace("/onboarding");
      } else if ((profile?.role === "broker" || profile?.role === "vendor") && !profile.onboarding_completed) {
        router.replace("/onboarding-partner");
      } else {
        router.replace("/dashboard");
      }
    } else {
      setChecked(true);
    }
  });
}, [router]);  if (!checked) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-6 py-10 text-center">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rotate-45 bg-blue-600 flex items-center justify-center rounded-md">
          <Truck className="-rotate-45" size={22} color="#ffffff" />
        </div>
        <div className="text-left">
          <p className="text-white font-bold tracking-wide leading-tight">BACKHAUL</p>
          <p className="text-blue-400 text-xs tracking-widest">NETWORK</p>
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-4xl font-bold leading-tight mb-4 max-w-sm">
        <span className="text-white">The Connected </span>
        <span className="text-blue-500">Network for Trucking</span>
      </h1>

      <p className="text-gray-300 max-w-sm mb-8">
        Connect with carriers, brokers, and vendors based on lanes,
        equipment, availability, and business needs.
      </p>

      {/* Truck photo */}
      <div className="w-full max-w-sm mb-6 rounded-lg overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=70"
          alt="Truck on highway"
          className="w-full h-56 object-cover"
        />
      </div>

      {/* Location line */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <MapPin size={16} className="text-blue-500" />
        <span>Starting in the Southeast • All equipment supported</span>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Link
          href="/signup"
          className="w-full py-3 rounded-md bg-blue-600 text-white font-semibold text-center hover:bg-blue-700 transition"
        >
          Create Account
        </Link>
        <Link
          href="/login"
          className="w-full py-3 rounded-md border border-white text-white font-semibold text-center hover:bg-white/10 transition"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
