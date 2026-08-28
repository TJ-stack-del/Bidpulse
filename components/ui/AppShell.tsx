import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

// Extracted from the <header> and mobile <nav> markup that repeats
// near-identically across all 43 mockups/*/code.html files.
// Every route wraps its content in this instead of copy-pasting the shell.

const DESKTOP_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bids", label: "Bids" },
  { href: "/intake", label: "My RFPs" },
  { href: "/opportunities", label: "Opportunities" },
];

const MOBILE_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/bids", label: "Bids", icon: "gavel" },
  { href: "/intake", label: "My RFPs", icon: "description" },
  { href: "/profile", label: "Profile", icon: "account_circle" },
];

export function AppShell({
  activePath,
  children,
}: {
  activePath: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="fixed top-0 w-full z-40 flex items-center justify-between px-margin-mobile md:px-margin-desktop py-3 bg-surface/95 backdrop-blur border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="font-bold text-headline-md text-on-surface">BidPulse</span>
        </div>
        <nav className="hidden md:flex gap-6">
          {DESKTOP_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-label-md px-3 py-2 rounded-lg transition-colors ${
                activePath === link.href
                  ? "text-secondary font-bold bg-surface-container-highest"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link
            href="/notifications"
            title="Notifications"
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </Link>
          <Link
            href="/settings/security"
            title="Settings"
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </Link>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container border border-outline-variant shrink-0 ml-1" />
          <SignOutButton />
        </div>
      </header>

      <main className="flex-grow pt-[80px] pb-[80px] md:pb-8 px-margin-mobile md:px-margin-desktop max-w-container mx-auto w-full flex flex-col gap-6">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-margin-mobile py-2 bg-surface border-t border-outline-variant">
        {MOBILE_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center justify-center transition-opacity active:opacity-80 ${
              activePath === link.href
                ? "text-secondary font-bold bg-surface-container-highest rounded-xl px-3 py-1"
                : "text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined">{link.icon}</span>
            <span className="text-label-md-mobile mt-1">{link.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
