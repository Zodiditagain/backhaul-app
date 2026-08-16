import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Lets an admin edit a blog draft's text/stat graphic and/or change its status:
//   publish_now -> goes live immediately, regardless of the review window
//   reject      -> permanently hidden, will never auto-publish
//   unpublish   -> pulls an already-live post back down (safety valve)
// Any of title/excerpt/content/headline_stat included in the body are saved
// regardless of which action (or no action) is sent, so "just save my edits"
// works too.
export async function PATCH(req, { params }) {
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

  const { id } = params;
  const body = await req.json();
  const { action, title, excerpt, content, headline_stat } = body;

  const updates = {};
  if (typeof title === "string") updates.title = title;
  if (typeof excerpt === "string") updates.excerpt = excerpt;
  if (typeof content === "string") updates.content = content;
  if (typeof headline_stat !== "undefined") updates.headline_stat = headline_stat;

  if (action === "publish_now") {
    updates.status = "published";
    updates.published_at = new Date().toISOString();
  } else if (action === "reject") {
    updates.status = "rejected";
  } else if (action === "unpublish") {
    updates.status = "rejected";
    updates.published_at = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}
