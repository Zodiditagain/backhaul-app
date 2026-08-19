import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// How long a draft sits in "Pending review" before it goes live on its own
// if nobody touches it. Matches api/blog/auto-submit/route.js.
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

// This does exactly what api/blog/auto-submit/route.js does, but gated on a
// logged-in admin session instead of the shared automation secret. It exists
// because the Marketing AI's scheduled run executes in a sandboxed cloud
// environment that cannot make outbound network calls to arbitrary external
// sites (including this one) — so it can no longer call auto-submit itself.
// Instead it prints the finished draft as JSON in its report, and an admin
// pastes that JSON here to submit it, from their own unrestricted browser.
export async function POST(req) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  });
}
