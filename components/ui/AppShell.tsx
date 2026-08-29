import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

// Extracted from the <header> and mobile <nav> markup that repeats
// near-identically across all 43 mockups/*/code.html files.
// Every route wraps its content in this instead of copy-pasting the shell.
//
// Nav links are role-based since BidPulse split admin (your team,
// works every client's submissions) from client (a contractor, sees only
// their own) — see MIGRATION-TO-SPECWRIGHT.md. The header's notifications/
// settings icons were dropped for now since those pages don't exist yet
// (nothing built them since the pivot) — add them back once they are.

type Role = "admin" | "client";

const NAV_LINKS: Record<Role, { href: string; label: string; icon: string }[]> = {
  admin: [
    { href: "/admin/inbox", label: "Inbox", icon: "inbox" },
    { href: "/admin/matches", label: "Matches", icon: "insights" },
  ],
  client: [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/intake", label: "New Bid", icon: "add_circle" },
  ],
};

export function AppShell({
  activePath,
  role,
  children,
}: {
  activePath: string;
  role: Role;
  children: React.ReactNode;
}) {
  const links = NAV_LINKS[role];

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="fixed top-0 w-full z-40 flex items-center justify-between px-margin-mobile md:px-margin-desktop py-3 bg-surface/95 backdrop-blur border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="font-bold text-headline-md text-on-surface">BidPulse</span>
        </div>
        <nav className="hidden md:flex gap-6">
          {links.map((link) => (
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
          <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container border border-outline-variant shrink-0" />
          <SignOutButton />
        </div>
      </header>

      <main className="flex-grow pt-[80px] pb-[80px] md:pb-8 px-margin-mobile md:px-margin-desktop max-w-container mx-auto w-full flex flex-col gap-6">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-margin-mobile py-2 bg-surface border-t border-outline-variant">
        {links.map((link) => (
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
