import "./globals.css";

export const metadata = {
  title: "Backhaul — Carrier Matching Network",
  description: "Matching trucking companies with brokers and vendors",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-concrete text-asphalt min-h-screen">{children}</body>
    </html>
  );
}
