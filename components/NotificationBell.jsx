"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function NotificationBell({ user }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  async function loadNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data || []);
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleClick(notif) {
    if (!notif.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    }
    setOpen(false);
    if (notif.match_id) {
      router.push(`/dashboard?openMatch=${notif.match_id}`);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen((v) => !v); if (!open) markAllRead(); }}
        className="relative flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-alertred rounded-full text-white text-[9px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 max-h-96 overflow-y-auto bg-white border border-gray-300 rounded-sm shadow-lg z-50">
          <div className="bg-asphalt text-white px-3 py-2 text-xs font-mono uppercase tracking-wide">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400 italic p-4 text-center">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${!n.read ? "bg-amberx/5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm ${!n.read ? "font-semibold text-asphalt" : "text-steelgray"}`}>
                      {n.title}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.message && <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
