"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
      else setChecked(true);
    });
  }, [router]);

  if (!checked) return null;

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1600&q=70')",
        }}
      />
      <div className="absolute inset-0 bg-asphalt/80" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-14 h-14 rotate-45 bg-amberx flex items-center justify-center mb-4">
          <Truck className="-rotate-45" size={26} color="#1B1E21" />
        </div>
        <h1 className="text-4xl font-bold tracking-wide mb-2 text-white">BACKHAUL</h1>
        <p className="text-gray-300 mb-8 max-w-sm">
          The matching network for trucking companies, brokers, and vendors.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-sm border border-white text-white font-mono text-sm uppercase tracking-wide hover:bg-white hover:text-asphalt transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-sm bg-amberx text-asphalt font-mono text-sm uppercase tracking-wide hover:bg-yellow-400 transition-colors"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
