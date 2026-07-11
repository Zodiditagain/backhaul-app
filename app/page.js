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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rotate-45 bg-amberx flex items-center justify-center mb-4">
        <Truck className="-rotate-45" size={26} color="#1B1E21" />
      </div>
      <h1 className="text-4xl font-bold tracking-wide mb-2">BACKHAUL</h1>
      <p className="text-steelgray mb-8">
        The matching network for trucking companies, brokers, and vendors.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="px-5 py-2.5 rounded-sm border border-asphalt font-mono text-sm uppercase tracking-wide hover:bg-asphalt hover:text-white transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2.5 rounded-sm bg-asphalt text-white font-mono text-sm uppercase tracking-wide hover:bg-steelgray transition-colors"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
