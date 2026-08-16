import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// How long a draft sits in "Pending review" before it goes live on its own
// if nobody touches it. Change this number to adjust the review window.
const REVIEW_WINDOW_HOURS = 48;

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// This is the only way anything gets written into blog_posts from outside
// the admin console. It's called by the scheduled Marketing AI routine, not
// by any browser — so it's protected by a shared secret header instead of a
// user login. The secret lives in this project's MARKETING_AI_SECRET env
// var and must match what's embedded in the scheduled routine's prompt.
export async function POST(req) {
  const secret = req.headers.get("x-automation-secret");
  if (!secret || secret !== process.env.MARKETING_AI_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, excerpt, content, sources, headline_stat } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const baseSlug = slugify(title) || "post";
  const uniqueSuffix = Date.now().toString(36);
  const slug = `${baseSlug}-${uniqueSuffix}`;

  const scheduledPublishAt = new Date(
    Date.now() + REVIEW_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .insert({
      slug,
      title,
      excerpt: excerpt || null,
      content,
      sources: sources || null,
      // { label, value, delta, direction: "good"|"bad"|"neutral", context }
      // Renders as the broadcast-style stat graphic at the top of the post.
      // Optional — a post with no headline_stat just skips that graphic.
      headline_stat: headline_stat || null,
      status: "scheduled",
      source: "marketing_ai",
      scheduled_publish_at: scheduledPublishAt,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    slug: data.slug,
    scheduled_publish_at: data.scheduled_publish_at,
    review_url: "https://backhaul-app-iota.vercel.app/admin/blog",
  });
}
