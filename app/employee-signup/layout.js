// Kept as a plain server-component layout (no "use client") specifically
// so this route can carry a noindex/nofollow tag — that export only works
// from a server component, and the actual signup page below needs to be a
// client component (it reads the invite token from the URL and manages
// form state). Search engines finding and indexing this URL isn't a
// security control by itself (the invite-token check is what actually
// gates signup), but there's no reason a private employee-signup page
// should ever show up in search results either.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function EmployeeSignupLayout({ children }) {
  return children;
}
