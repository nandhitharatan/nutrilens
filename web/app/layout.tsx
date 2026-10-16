import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Camera, Home, User, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Nutrilens | Look Beyond the Label",
  description: "Read packaged-food label photos and check them against your dietary profile. Unknown is never safe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-parchment text-ink min-h-screen flex flex-col antialiased selection:bg-gold selection:text-ink">
        {/* Top Navbar (Desktop & Tablet) */}
        <header className="sticky top-0 z-40 bg-parchment/95 backdrop-blur-sm border-b border-ink-border px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded bg-oxblood flex items-center justify-center text-parchment-light shadow-sm">
                <ShieldCheck className="w-5 h-5 text-parchment" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading font-bold text-lg tracking-tight text-ink leading-none">
                  Nutrilens
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted">
                  Look Beyond the Label
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link
                href="/"
                className="text-ink-muted hover:text-ink transition-colors"
              >
                Home
              </Link>
              <Link
                href="/scan"
                className="px-4 py-2 bg-oxblood text-parchment rounded hover:bg-oxblood-hover transition-colors shadow-sm flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Label</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Tabs (Narrow Screens only) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-parchment-light border-t border-ink-border flex items-center justify-around py-2 px-4 shadow-lg">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-ink-muted hover:text-ink transition-colors py-1 px-3"
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px] font-medium">Home</span>
          </Link>

          {/* Central Prominent Scan Button */}
          <Link
            href="/scan"
            className="flex flex-col items-center -mt-6 group"
            aria-label="Scan label"
          >
            <div className="w-14 h-14 rounded-full bg-oxblood text-parchment flex items-center justify-center shadow-md border-4 border-parchment group-hover:bg-oxblood-hover transition-transform group-active:scale-95">
              <Camera className="w-6 h-6 text-parchment" />
            </div>
            <span className="text-[11px] font-bold text-oxblood mt-0.5">Scan</span>
          </Link>

          <Link
            href="/profile"
            className="flex flex-col items-center gap-1 text-ink-muted hover:text-ink transition-colors py-1 px-3"
          >
            <User className="w-5 h-5" />
            <span className="text-[11px] font-medium">Profile</span>
          </Link>
        </nav>
      </body>
    </html>
  );
}
