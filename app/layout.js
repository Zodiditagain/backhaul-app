import "./globals.css";

export const metadata = {
  title: "Backhaul — Carrier Matching Network",
  description: "Matching trucking companies with brokers and vendors",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-concrete text-asphalt min-h-screen">
        {children}
        {/* Sits on every page via the root layout, on purpose — one edit here
            covers every route instead of touching each page individually.
            Fixed, tiny, and pointer-events-none so it never blocks a click
            or covers map controls, even on full-screen views like Route Map.
            The strip itself carries its own dark background (not just a
            gradient) so the light text stays readable whether the page
            underneath is one of the dark auth screens or a light dashboard/
            admin screen. */}
        <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none text-center text-[10px] text-gray-300 py-1 bg-slate-950/80">
          © {new Date().getFullYear()} Backhaul Network. All rights reserved.
        </div>
      </body>
    </html>
  );
}
