"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { TAGLINE } from "@/lib/brand";

// Shared header/footer for the public marketing site — separate from
// AppShell, which is for the authenticated app and branches nav by role.
// Nobody needs a role here; every visitor sees the same nav, plus
// Log in / Get started. Visual system matches the new BidPulse mockups.

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/quiz", label: "Fit-Score Quiz" },
  { href: "/gallery", label: "Gallery" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
];

export function MarketingShell({
  activePath,
  children,
}: {
  activePath: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center justify-between w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <Link href="/" onClick={() => setMenuOpen(false)} className="flex flex-col justify-center">
            <Image src="/logo.png" alt="BidPulse" width={134} height={40} className="h-10 w-auto dark:hidden" priority />
            <Image
              src="/logo-dark.png"
              alt="BidPulse"
              width={134}
              height={40}
              className="hidden h-10 w-auto dark:block"
              priority
            />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-label-md px-1 py-1 transition ${
                  activePath === link.href
                    ? "text-secondary font-bold border-b-2 border-secondary"
                    : "text-on-surface-variant hover:text-secondary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-label-md text-on-surface-variant hover:text-secondary transition">
              Log in
            </Link>
            <Link
              href="/intake"
              className="px-4 py-2 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition active:scale-[0.97]"
            >
              Get started
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="md:hidden p-2 -mr-2 text-on-surface"
          >
            <span className="material-symbols-outlined">{menuOpen ? "close" : "menu"}</span>
          </button>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-outline-variant bg-surface px-margin-mobile py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`text-label-md py-3 transition ${
                  activePath === link.href ? "text-secondary font-bold" : "text-on-surface-variant"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-outline-variant mt-2 pt-4 flex flex-col gap-3">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="text-label-md text-on-surface-variant"
              >
                Log in
              </Link>
              <Link
                href="/intake"
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 bg-secondary text-on-secondary rounded text-label-md text-center active:scale-[0.97]"
              >
                Get started
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main className="animate-fade-in flex-grow w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-section-gap flex flex-col gap-section-gap">
        {children}
      </main>

      <footer className="bg-surface-container-lowest border-t border-outline-variant mt-auto">
        <div className="w-full px-margin-mobile md:px-margin-desktop py-gutter max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="BidPulse" width={107} height={32} className="h-8 w-auto dark:hidden" />
            <Image
              src="/logo-dark.png"
              alt="BidPulse"
              width={107}
              height={32}
              className="hidden h-8 w-auto dark:block"
            />
            <div className="flex flex-col">
              <span className="text-label-sm text-on-surface-variant">{TAGLINE}</span>
              <span className="text-body-sm text-on-surface-variant">© {new Date().getFullYear()} BidPulse</span>
            </div>
          </div>
          <nav className="flex flex-wrap justify-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-label-sm text-on-surface-variant hover:text-secondary transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
