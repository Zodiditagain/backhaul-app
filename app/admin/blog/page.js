"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, CheckCircle2, XCircle, Clock, Globe, RotateCcw } from "lucide-react";
import { supabase, authHeaders } from "../../../lib/supabaseClient";
import BlogStatHeader from "../../../components/BlogStatHeader";

const EMPTY_STAT = { label: "", value: "", delta: "", direction: "neutral", context: "" };

function statusInfo(post) {
  const now = new Date();
  const scheduledAt = post.scheduled_publish_at ? new Date(post.scheduled_publish_at) : null;

  if (post.status === "published") {
    return { label: "Live", color: "bg-green-100 text-green-800 border-green-300" };
  }
  if (post.status === "rejected") {
    return { label: "Rejected — will not publish", color: "bg-red-100 text-red-800 border-red-300" };
  }
  if (post.status === "scheduled" && scheduledAt && scheduledAt <= now) {
    return { label: "Live (auto-published)", color: "bg-green-100 text-green-800 border-green-300" };
  }
  return { label: "Pending review", color: "bg-amber-100 text-amber-800 border-amber-300" };
}

function isLive(post) {
  const scheduledAt = post.scheduled_publish_at ? new Date(post.scheduled_publish_at) : null;
  return post.status === "published" || (post.status === "scheduled" && scheduledAt && scheduledAt <= new Date());
}

export default function AdminBlogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [posts, setPosts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function loadPosts() {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/blog", { headers });
    if (!res.ok) {
      setError("Couldn't load blog posts.");
      return;
    }
    const json = await res.json();
    setPosts(json.posts || []);
    const nextDrafts = {};
    (json.posts || []).forEach((p) => {
      nextDrafts[p.id] = {
        title: p.title,
        excerpt: p.excerpt || "",
        content: p.content,
        headline_stat: { ...EMPTY_STAT, ...(p.headline_stat || {}) },
      };
    });
    setDrafts(nextDrafts);
  }

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", sessionData.session.user.id)
        .single();

      if (!myProfile?.is_admin) {
        router.replace("/dashboard");
        return;
      }
      setAuthorized(true);
      await loadPosts();
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function updateDraft(id, field, value) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function updateStat(id, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], headline_stat: { ...prev[id].headline_stat, [field]: value } },
    }));
  }

  async function submitAction(id, action) {
    setBusyId(id);
    setError("");
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const draft = drafts[id] || {};
    const hasStat = draft.headline_stat && draft.headline_stat.value;
    const res = await fetch(`/api/admin/blog/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        action,
        title: draft.title,
        excerpt: draft.excerpt,
        content: draft.content,
        headline_stat: hasStat ? draft.headline_stat : null,
      }),
    });
    if (!res.ok) {
      setError("That action failed. Try again.");
    } else {
      await loadPosts();
    }
    setBusyId(null);
  }

  if (loading) return <div className="p-8 text-steelgray">Loading blog review...</div>;
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-asphalt border-b-4 border-amberx">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rotate-45 bg-amberx flex items-center justify-center">
              <Shield className="-rotate-45" size={18} color="#1B1E21" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold leading-none">BLOG REVIEW</h1>
              <p className="text-gray-400 text-[11px] uppercase tracking-widest mt-0.5">Marketing AI Drafts</p>
            </div>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
          >
            <ArrowLeft size={14} /> Back to Admin
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6 space-y-4">
        <div className="bg-white border border-gray-300 rounded-sm p-4 text-sm text-steelgray">
          Every article the Marketing AI writes lands here first. If you don&apos;t act on it, it
          goes live on its own <strong>48 hours</strong> after it was drafted — edit it, publish it
          immediately, or reject it any time before then. Already live and want it down? Use
          Unpublish.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-sm p-3">{error}</div>
        )}

        {posts.length === 0 && (
          <div className="bg-white border border-gray-300 rounded-sm p-6 text-center text-sm text-gray-500">
            No blog drafts yet. The Marketing AI submits one weekly.
          </div>
        )}

        {posts.map((post) => {
          const info = statusInfo(post);
          const draft = drafts[post.id] || { title: "", excerpt: "", content: "", headline_stat: EMPTY_STAT };
          const scheduledAt = post.scheduled_publish_at ? new Date(post.scheduled_publish_at) : null;
          const live = isLive(post);
          return (
            <div key={post.id} className="bg-white border border-gray-300 rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className={`text-[10px] font-mono uppercase tracking-wide border rounded-sm px-2 py-1 ${info.color}`}>
                  {info.label}
                </span>
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  {!live && scheduledAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Auto-publishes {scheduledAt.toLocaleString()}
                    </span>
                  )}
                  {live && (
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <Globe size={12} /> View live
                    </Link>
                  )}
                </div>
              </div>

              <input
                value={draft.title}
                onChange={(e) => updateDraft(post.id, "title", e.target.value)}
                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm font-semibold"
              />
              <textarea
                value={draft.excerpt}
                onChange={(e) => updateDraft(post.id, "excerpt", e.target.value)}
                placeholder="Short excerpt / summary"
                rows={2}
                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-xs text-gray-600"
              />
              <textarea
                value={draft.content}
                onChange={(e) => updateDraft(post.id, "content", e.target.value)}
                rows={10}
                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
              />
              {post.sources && (
                <p className="text-[11px] text-gray-400">Sources cited by the AI: {post.sources}</p>
              )}

              <div className="border-t border-gray-200 pt-3">
                <p className="text-[11px] uppercase tracking-wide font-mono text-gray-400 mb-2">
                  Headline stat graphic (shown at the top of the post — leave value blank to hide it)
                </p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    value={draft.headline_stat.label}
                    onChange={(e) => updateStat(post.id, "label", e.target.value)}
                    placeholder="Eyebrow label, e.g. This week in freight"
                    className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                  />
                  <input
                    value={draft.headline_stat.value}
                    onChange={(e) => updateStat(post.id, "value", e.target.value)}
                    placeholder="Big value, e.g. $5.31/gal"
                    className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                  />
                  <input
                    value={draft.headline_stat.delta}
                    onChange={(e) => updateStat(post.id, "delta", e.target.value)}
                    placeholder="Delta badge text, e.g. +13.8% vs last month"
                    className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                  />
                  <select
                    value={draft.headline_stat.direction}
                    onChange={(e) => updateStat(post.id, "direction", e.target.value)}
                    className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                  >
                    <option value="good">Good news for truckers (green)</option>
                    <option value="bad">Bad news for truckers (red)</option>
                    <option value="neutral">Neutral / informational (blue)</option>
                  </select>
                </div>
                <input
                  value={draft.headline_stat.context}
                  onChange={(e) => updateStat(post.id, "context", e.target.value)}
                  placeholder="Small source/context line, e.g. Diesel avg., BlueGrace Logistics, Aug 2026"
                  className="w-full border border-gray-300 rounded-sm px-2 py-1.5 text-xs mb-3"
                />
                {draft.headline_stat.value && (
                  <div className="bg-slate-950 rounded-sm p-3">
                    <BlogStatHeader stat={draft.headline_stat} variant="full" />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => submitAction(post.id, "save")}
                  disabled={busyId === post.id}
                  className="text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-sm border border-gray-300 text-steelgray hover:bg-gray-50"
                >
                  Save Edits
                </button>
                {!live && (
                  <button
                    onClick={() => submitAction(post.id, "publish_now")}
                    disabled={busyId === post.id}
                    className="flex items-center gap-1 text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-sm bg-green-600 text-white hover:bg-green-700"
                  >
                    <CheckCircle2 size={13} /> Publish Now
                  </button>
                )}
                {post.status !== "rejected" && !live && (
                  <button
                    onClick={() => submitAction(post.id, "reject")}
                    disabled={busyId === post.id}
                    className="flex items-center gap-1 text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-sm bg-red-600 text-white hover:bg-red-700"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                )}
                {live && (
                  <button
                    onClick={() => submitAction(post.id, "unpublish")}
                    disabled={busyId === post.id}
                    className="flex items-center gap-1 text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-sm bg-red-600 text-white hover:bg-red-700"
                  >
                    <RotateCcw size={13} /> Unpublish
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
