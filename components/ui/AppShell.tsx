import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

// Extracted from the <header> and mobile <nav> markup that repeats
// near-identically across all 43 mockups/*/code.html files.
// Every route wraps its content in this instead of copy-pasting the shell.
//
// Nav links are role-based since BidPulse split admin (your team,
// works every client's submissions) from client (a contractor, sees only
// their own) — see MIGRATION-TO-BIDPULSE.md. The header's notifications/
// settings icons were dropped for now since those pages don't exist yet
// (nothing built them since the pivot) — add them back once they are.

type Role = "admin" | "client";

const NAV_LINKS: Record<Role, { href: string; label: string; icon: string }[]> = {
  admin: [
    { href: "/admin/inbox", label: "Inbox", icon: "inbox" },
    { href: "/admin/matches", label: "Matches", icon: "insights" },
    { href: "/admin/messages", label: "Messages", icon: "mail" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
  ],
  client: [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/intake", label: "New Bid", icon: "add_circle" },
    { href: "/dashboard/profile", label: "Profile", icon: "badge" },
  ],
};

export function AppShell({
  activePath,
  role,
  viewerName,
  children,
}: {
  activePath: string;
  role: Role;
  // The signed-in admin's full name (team_members.full_name) or the
  // signed-in client's business name (clients.company_name) — whichever
  // record the caller already fetched to know `role` in the first place.
  viewerName: string;
  children: React.ReactNode;
}) {
  const links = NAV_LINKS[role];

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="fixed top-0 w-full z-40 flex items-center justify-between px-margin-mobile md:px-margin-desktop py-3 bg-surface/95 backdrop-blur border-b border-outline-variant">
        <Image src="/logo.png" alt="BidPulse" width={134} height={40} className="h-9 w-auto shrink-0" priority />
        <nav className="hidden md:flex gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-label-md px-3 py-2 rounded-lg transition ${
                activePath === link.href
                  ? "text-secondary font-bold bg-surface-container-highest"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <p className="hidden sm:block text-label-md text-on-surface-variant whitespace-nowrap">
            {viewerName} · {role === "admin" ? "Admin" : "Client view"}
          </p>
          <ThemeToggle />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container border border-outline-variant shrink-0" />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="animate-fade-in flex-grow pt-[72px] pb-[80px] md:pb-8 px-margin-mobile md:px-margin-desktop max-w-container mx-auto w-full flex flex-col gap-6">
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
