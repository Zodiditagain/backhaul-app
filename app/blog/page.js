import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Truck } from "lucide-react";
import BlogStatHeader from "../../components/BlogStatHeader";

export const metadata = {
  title: "Blog — Backhaul",
};

export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function BlogListPage() {
  // Row Level Security on blog_posts only allows this anon-key query to see
  // posts that are actually published, or scheduled posts whose review
  // window has already passed — drafts still pending review never reach
  // this query, regardless of what we ask for here.
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, published_at, scheduled_publish_at, headline_stat")
    .order("scheduled_publish_at", { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-6"
        >
          <ArrowLeft size={14} />
          Back
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rotate-45 bg-blue-600 flex items-center justify-center rounded-md">
            <Truck className="-rotate-45" size={18} color="#ffffff" />
          </div>
          <h1 className="text-2xl font-bold text-white">Backhaul Blog</h1>
        </div>

        {(!posts || posts.length === 0) && (
          <p className="text-gray-400 text-sm">No posts yet — check back soon.</p>
        )}

        <div className="space-y-6">
          {(posts || []).map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block border border-slate-800 rounded-lg p-5 hover:border-blue-600 transition"
            >
              <BlogStatHeader stat={post.headline_stat} variant="compact" />
              <h2 className="text-white font-semibold text-lg mb-1">{post.title}</h2>
              {post.excerpt && <p className="text-gray-400 text-sm mb-2">{post.excerpt}</p>}
              <p className="text-gray-600 text-xs">
                {new Date(post.published_at || post.scheduled_publish_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
