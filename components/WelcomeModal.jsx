"use client";
import { Search, Star, Bell, Store, X } from "lucide-react";

const WELCOME_BENEFITS = [
  { icon: Search, text: "Carrier Search & Vetting" },
  { icon: Star, text: "Saved Carrier Lists" },
  { icon: Bell, text: "Capacity Alerts" },
  { icon: Store, text: "Vendor Network" },
];

// One-time modal shown to brokers/vendors right after their first dashboard
// login. Purely informational — the actual $199/mo billing + 30-day trial
// enforcement isn't wired up yet, so nothing here triggers a real charge.
export default function WelcomeModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
      <div className="bg-slate-900 border border-blue-900/40 rounded-md max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-white"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-bold text-white mb-1 pr-6">
          You're in. Here's what's included in your $199/month.
        </h2>

        <ul className="space-y-2 my-4">
          {WELCOME_BENEFITS.map((b) => (
            <li key={b.text} className="flex items-center gap-2 text-sm text-gray-200">
              <b.icon size={15} className="text-blue-400 shrink-0" />
              {b.text}
            </li>
          ))}
        </ul>

        <div className="bg-slate-950 border border-slate-800 rounded-md p-3 mb-4 overflow-x-auto">
          <p className="text-xs text-gray-400 mb-2">See what you're actually saving:</p>
          <table className="w-full text-[11px] text-gray-300 min-w-[320px]">
            <thead>
              <tr className="text-gray-500 uppercase text-[10px]">
                <th className="text-left font-medium pb-1"></th>
                <th className="text-left font-medium pb-1">Backhaul</th>
                <th className="text-left font-medium pb-1">Truckstop Pro</th>
                <th className="text-left font-medium pb-1">DAT One</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pr-2 py-0.5 text-gray-400">Price</td>
                <td className="py-0.5 font-semibold text-white">$199/mo flat</td>
                <td className="py-0.5">$239/user/mo</td>
                <td className="py-0.5">$195–345/mo</td>
              </tr>
              <tr>
                <td className="pr-2 py-0.5 text-gray-400">Per-seat fees</td>
                <td className="py-0.5 text-green-400">No</td>
                <td className="py-0.5 text-red-400">Yes</td>
                <td className="py-0.5 text-red-400">Yes</td>
              </tr>
              <tr>
                <td className="pr-2 py-0.5 text-gray-400">Vendor network</td>
                <td className="py-0.5 text-green-400">Yes</td>
                <td className="py-0.5 text-red-400">No</td>
                <td className="py-0.5 text-red-400">No</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mb-4">Cancel anytime during your first 30 days.</p>

        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-md font-semibold text-sm transition"
        >
          Explore Your Dashboard
        </button>
      </div>
    </div>
  );
}
