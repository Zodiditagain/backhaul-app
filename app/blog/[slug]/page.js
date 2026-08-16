import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Truck } from "lucide-react";
import BlogStatHeader from "../../../components/BlogStatHeader";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt")
    .eq("slug", params.slug)
    .single();

  return {
    title: post ? `${post.title} — Backhaul Blog` : "Backhaul Blog",
    description: post?.excerpt || undefined,
  };
}

export default async function BlogPostPage({ params }) {
  // Same RLS-backed anon query as the list page — if this post hasn't
  // cleared review yet, Supabase simply won't return it and we 404.
  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!post) return notFound();

  const dateLabel = new Date(post.published_at || post.scheduled_publish_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const paragraphs = post.content.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-6"
        >
          <ArrowLeft size={14} />
          All posts
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rotate-45 bg-blue-600 flex items-center justify-center rounded-md">
            <Truck className="-rotate-45" size={18} color="#ffffff" />
          </div>
          <p className="text-gray-500 text-xs uppercase tracking-widest">Backhaul Blog</p>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">{post.title}</h1>
        <p className="text-xs text-gray-500 mb-6">{dateLabel}</p>

        <BlogStatHeader stat={post.headline_stat} variant="full" />

        <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {post.sources && (
          <p className="mt-10 pt-4 border-t border-slate-800 text-xs text-gray-500">
            Sources: {post.sources}
          </p>
        )}
      </div>
    </div>
  );
}
