"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Truck,
  LayoutGrid,
  MessageSquare,
  Search,
  Star,
  Bell,
  BarChart3,
  Gift,
  Store,
  Calculator,
  Map,
  Activity,
  Newspaper,
  LifeBuoy,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import NotificationBell from "./NotificationBell";

// Reusable dark "navy-and-cyan" sidebar + top-bar shell for the dashboard
// redesign. Wraps a page's content:
//
//   <Sidebar user={user} profile={profile} title="Overview">
//     ...page content...
//   </Sidebar>
//
// Role flags are derived here from profile.role using the same convention
// used everywhere else in the app (app/dashboard/page.js, MatchThread.jsx,
// etc.) so nav items show/hide exactly like the old top header did. This is
// meant to become the shell for every logged-in page over time — for now
// it's wired up on /dashboard and /messages only.
export default function Sidebar({ user, profile, title = "Overview", children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPartner = profile?.role === "broker" || profile?.role === "vendor";
  const isTrucker = profile?.role === "trucker";
  const isVendor = profile?.role === "vendor";

  function isActiveHref(href) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const groups = [
    {
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutGrid },
        { href: "/messages", label: "Messages", icon: MessageSquare },
      ],
    },
    {
      title: "Carriers",
      hidden: !isPartner,
      items: [
        { href: "/broker/search-carriers", label: "Search Carriers", icon: Search },
        { href: "/available-trucks", label: "Available Trucks", icon: Truck },
        { href: "/broker/saved-carriers", label: "Saved Carriers", icon: Star },
        { href: "/broker/capacity-alerts", label: "Capacity Alerts", icon: Bell },
      ],
    },
    {
      title: "Grow",
      hidden: !isPartner,
      items: [
        { href: "/broker/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/broker/referrals", label: "Referrals", icon: Gift },
      ],
    },
    {
      title: "Account",
      hidden: !isPartner,
      items: [{ href: "/broker/settings", label: "Settings", icon: Settings }],
    },
    {
      title: "On The Road",
      hidden: !isTrucker,
      items: [
        { href: "/route-map", label: "Route Map", icon: Map },
        { href: "/market-pulse", label: "Market Pulse", icon: Activity },
      ],
    },
    {
      title: "Resources",
      items: [
        { href: "/business-tools", label: "Business Tools", icon: Calculator, hidden: !(isTrucker || isPartner) },
        { href: "/vendors", label: "Vendor Directory", icon: Store, hidden: !(isTrucker || isPartner) },
        { href: "/vendor-profile", label: "Vendor Profile", icon: Store, hidden: !isVendor },
        { href: "/support", label: "Support", icon: LifeBuoy },
        { href: "/blog", label: "Blog", icon: Newspaper },
      ],
    },
    {
      hidden: !profile?.is_admin,
      items: [{ href: "/admin", label: "Admin", icon: Shield }],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:flex-col fixed inset-y-0 left-0 z-30 bg-[#0B1526] border-r border-slate-800/60 transition-all duration-150 ${
          collapsed ? "md:w-20" : "md:w-64"
        }`}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          groups={groups}
          isActiveHref={isActiveHref}
          isPartner={isPartner}
        />
      </aside>

      {/* Mobile off-canvas drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-[#0B1526] flex flex-col">
            <SidebarContent
              collapsed={false}
              onClose={() => setMobileOpen(false)}
              groups={groups}
              isActiveHref={isActiveHref}
              isPartner={isPartner}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className={`transition-all duration-150 ${collapsed ? "md:pl-20" : "md:pl-64"}`}>
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="[&_button]:!text-slate-500 [&_button:hover]:!text-cyan-600">
              <NotificationBell user={user} />
            </div>
            <div className="hidden sm:block text-right leading-none">
              <p className="text-xs font-semibold text-slate-700">{profile?.company_name}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">{profile?.role}</p>
            </div>
          </div>
        </header>
        <main className="px-4 sm:px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({ collapsed, onToggleCollapse, onClose, groups, isActiveHref, isPartner, onNavigate }) {
  return (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800/60 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0">
          <Truck size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-none tracking-wide">BACKHAUL</p>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mt-1">Broker Console</p>
          </div>
        )}
        {onClose ? (
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        ) : (
          <button
            onClick={onToggleCollapse}
            className="ml-auto text-slate-500 hover:text-cyan-400 hidden md:block"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((group, gi) => {
          const visibleItems = group.items.filter((i) => !i.hidden);
          if (group.hidden || visibleItems.length === 0) return null;
          return (
            <div key={gi}>
              {group.title && !collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {group.title}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(({ href, label, icon: Icon }) => {
                  const active = isActiveHref(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
                        active
                          ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white border-transparent"
                      }`}
                    >
                      <Icon size={17} className={active ? "text-cyan-300 shrink-0" : "text-slate-400 shrink-0"} />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/60 p-3 shrink-0">
        {isPartner && (
          <Link
            href="/onboarding-partner"
            onClick={onNavigate}
            title={collapsed ? "Edit Profile" : undefined}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white"
          >
            <Settings size={17} className="text-slate-400 shrink-0" />
            {!collapsed && <span>Edit Profile</span>}
          </Link>
        )}
        <LogoutButton collapsed={collapsed} />
      </div>
    </>
  );
}

function LogoutButton({ collapsed }) {
  const router = useRouter();
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }
  return (
    <button
      onClick={handleLogout}
      title={collapsed ? "Log out" : undefined}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-300"
    >
      <LogOut size={17} className="text-slate-400 shrink-0" />
      {!collapsed && <span>Log out</span>}
    </button>
  );
}
