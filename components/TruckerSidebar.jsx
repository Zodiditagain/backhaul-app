"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Truck,
  LayoutGrid,
  MessageSquare,
  Map,
  Activity,
  User,
  Wrench,
  Calculator,
  Store,
  LifeBuoy,
  Newspaper,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import NotificationBell from "./NotificationBell";

// Dark "carrier network" sidebar + header shell for trucker-facing pages —
// deliberately a different visual style from the broker/vendor Sidebar.jsx
// (light top bar, navy rail). Wraps a page's content:
//
//   <TruckerSidebar user={user} profile={profile} title="Overview">
//     ...page content...
//   </TruckerSidebar>
//
// Rolled out so far on: /dashboard (Overview), /truck-profiles. Carrier
// Profile lives at /carrier-profile. Messages/Route Map/Market Pulse reuse
// their existing pages unchanged for now — only the shell around them is new.
//
// NOT YET BUILT (intentionally left off this nav for now rather than linking
// somewhere fake): a dedicated "My Loads" list, a "Documents & BOL" archive
// separate from each match's own thread, a standalone "My Availability"
// history page (the live toggle itself lives right on Overview), Referrals,
// and Settings. These are real, deferred follow-up work, not omissions by
// accident.
export default function TruckerSidebar({ user, profile, title = "Overview", children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    async function loadUnread() {
      const { data: matchData } = await supabase
        .from("matches")
        .select("id, trucker_last_read_at")
        .eq("trucker_id", user.id)
        .eq("status", "accepted");
      const matches = matchData || [];
      if (matches.length === 0) {
        if (!cancelled) setUnreadMessages(0);
        return;
      }
      const { data: msgData } = await supabase
        .from("messages")
        .select("match_id, sender_id, created_at")
        .in(
          "match_id",
          matches.map((m) => m.id)
        )
        .order("created_at", { ascending: false });
      const latestByMatch = {};
      (msgData || []).forEach((m) => {
        if (!latestByMatch[m.match_id]) latestByMatch[m.match_id] = m;
      });
      const unreadCount = matches.filter((m) => {
        const lastMsg = latestByMatch[m.id];
        if (!lastMsg || lastMsg.sender_id === user.id) return false;
        if (!m.trucker_last_read_at) return true;
        return new Date(lastMsg.created_at) > new Date(m.trucker_last_read_at);
      }).length;
      if (!cancelled) setUnreadMessages(unreadCount);
    }
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id]);

  function isActiveHref(href) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const groups = [
    {
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutGrid },
        { href: "/messages", label: "Messages", icon: MessageSquare, badge: unreadMessages },
      ],
    },
    {
      title: "On The Road",
      items: [
        { href: "/route-map", label: "Route Map", icon: Map },
        { href: "/market-pulse", label: "Market Pulse", icon: Activity },
      ],
    },
    {
      title: "My Business",
      items: [
        { href: "/carrier-profile", label: "Carrier Profile", icon: User },
        { href: "/truck-profiles", label: "Truck & Equipment", icon: Wrench },
      ],
    },
    {
      title: "Resources",
      items: [
        { href: "/business-tools", label: "Business Tools", icon: Calculator },
        { href: "/vendors", label: "Vendor Directory", icon: Store },
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
    <div className="min-h-screen bg-[#0b1220]">
      <aside
        className={`hidden md:flex md:flex-col fixed inset-y-0 left-0 z-30 bg-[#060911] border-r border-white/5 transition-all duration-150 ${
          collapsed ? "md:w-20" : "md:w-64"
        }`}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          groups={groups}
          isActiveHref={isActiveHref}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-[#060911] flex flex-col">
            <SidebarContent
              collapsed={false}
              onClose={() => setMobileOpen(false)}
              groups={groups}
              isActiveHref={isActiveHref}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className={`transition-all duration-150 ${collapsed ? "md:pl-20" : "md:pl-64"}`}>
        <header className="sticky top-0 z-20 bg-[#0b1220]/95 backdrop-blur border-b border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="[&_button]:!text-slate-400 [&_button:hover]:!text-blue-400 [&_.bg-white]:!bg-[#111827] [&_.border-slate-200]:!border-white/10 [&_.text-slate-900]:!text-white [&_.text-slate-700]:!text-slate-200 [&_.text-slate-500]:!text-slate-400 [&_.hover\\:bg-slate-50:hover]:!bg-white/5">
              <NotificationBell user={user} />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-300 text-xs font-bold shrink-0">
                {(profile?.company_name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-none">
                <p className="text-xs font-semibold text-white">{profile?.company_name}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">Carrier</p>
              </div>
            </div>
          </div>
        </header>
        <main className="px-4 sm:px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({ collapsed, onToggleCollapse, onClose, groups, isActiveHref, onNavigate }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center shrink-0">
          <Truck size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-none tracking-wide">BACKHAUL</p>
            <p className="text-blue-400 text-[10px] uppercase tracking-widest mt-1">Carrier Network</p>
          </div>
        )}
        {onClose ? (
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white p-1">
            <X size={18} />
          </button>
        ) : (
          <button
            onClick={onToggleCollapse}
            className="ml-auto text-slate-500 hover:text-blue-400 hidden md:block"
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
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  {group.title}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(({ href, label, icon: Icon, badge }) => {
                  const active = isActiveHref(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
                        active
                          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                          : "text-slate-300 hover:bg-white/5 hover:text-white border-transparent"
                      }`}
                    >
                      <Icon size={17} className={active ? "text-blue-300 shrink-0" : "text-slate-500 shrink-0"} />
                      {!collapsed && <span className="truncate flex-1">{label}</span>}
                      {!collapsed && badge > 0 && (
                        <span className="shrink-0 bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3 shrink-0">
        <button
          onClick={handleLogout}
          title={collapsed ? "Log out" : undefined}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut size={17} className="text-slate-500 shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </>
  );
}
