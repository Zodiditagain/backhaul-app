import { createClient } from "@supabase/supabase-js";

// A plain anon-key client used only to validate bearer tokens on incoming
// API requests. This does not hold a session of its own — auth.getUser(jwt)
// just checks that the token a client sent us is a real, current Supabase
// session and tells us who it belongs to.
const supabaseAuthClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Reads the `Authorization: Bearer <token>` header a client should attach
// to requests (see lib/supabaseClient.js's authHeaders() for the client
// side of this) and validates it against Supabase Auth. Returns the
// authenticated user, or null if the request has no valid session — callers
// should respond 401 when this returns null. This only confirms *who* is
// asking; routes that need more than "is logged in" (e.g. an active
// subscription) should check that themselves after calling this.
export async function getAuthedUser(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
