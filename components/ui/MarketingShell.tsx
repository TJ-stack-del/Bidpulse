import Link from "next/link";

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
  return (
    <div className="min-h-screen flex flex-col bg-background text-on-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center justify-between w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <Link href="/" className="font-bold text-headline-md text-primary">
            BidPulse
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-label-md px-1 py-1 transition-colors ${
                  activePath === link.href
                    ? "text-secondary font-bold border-b-2 border-secondary"
                    : "text-on-surface-variant hover:text-secondary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-label-md text-on-surface-variant hover:text-secondary transition-colors">
              Log in
            </Link>
            <Link
              href="/intake"
              className="px-4 py-2 bg-secondary text-on-secondary rounded text-label-md hover:bg-on-secondary-container transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-section-gap flex flex-col gap-section-gap">
        {children}
      </main>

      <footer className="bg-surface-container-lowest border-t border-outline-variant mt-auto">
        <div className="w-full px-margin-mobile md:px-margin-desktop py-gutter max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          <span className="text-body-sm text-on-surface-variant">
            © {new Date().getFullYear()} BidPulse
          </span>
          <nav className="flex flex-wrap justify-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-label-sm text-on-surface-variant hover:text-secondary transition-colors"
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
