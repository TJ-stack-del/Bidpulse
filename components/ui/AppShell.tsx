"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

// Extracted from the <header> and mobile <nav> markup that repeats
// near-identically across all 43 mockups/*/code.html files.
//
// Now mounted once per section, from app/dashboard/layout.tsx and
// app/admin/layout.tsx, rather than individually by every page -- when
// every page rendered its own AppShell instance, React had to unmount
// and remount the whole header/sidebar/nav on every navigation within
// the same section (see globals.css's .animate-fade-in comment, which
// existed specifically to soften that remount's visible flash). A real
// Next.js layout persists across navigations in the same segment
// instead, so the shell no longer disappears and reappears at all.
// Active-link highlighting used to come from a per-page `activePath`
// prop for this reason -- a shared layout doesn't know which page
// rendered it, so this now reads the real current path directly via
// usePathname() instead.
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

const SIDEBAR_LABEL: Record<Role, string> = {
  admin: "Operational Modules",
  client: "Your Account",
};

// Where the logo should take a signed-in user of each role -- their own
// section's real home, not the marketing site. "/" would technically also
// get them there (app/page.tsx's root routing bounces a signed-in user
// straight to one of these two), but linking directly avoids that extra
// redirect hop and matches what clicking a logo means inside a logged-in
// app: take me home, not out to the public site.
const HOME_PATH: Record<Role, string> = {
  admin: "/admin/inbox",
  client: "/dashboard",
};

// Defensive display-only cleanup, not a data fix: a stored full_name of
// "Michaal_Coleman" (a real typo'd value, not code) rendered here with
// this header's own `uppercase` class as the literal "MICHAAL_COLEMAN" --
// underscores should never appear in a human display name regardless of
// whose name it is, so they're normalized to spaces here. This does NOT
// fix the actual spelling typo, which lives in team_members.full_name
// itself and needs a real UPDATE to that row, not a code change.
function formatViewerName(name: string): string {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function AppShell({
  role,
  viewerName,
  children,
}: {
  role: Role;
  // The signed-in admin's full name (team_members.full_name) or the
  // signed-in client's business name (clients.company_name) — whichever
  // record the caller already fetched to know `role` in the first place.
  viewerName: string;
  children: React.ReactNode;
}) {
  const links = NAV_LINKS[role];
  const pathname = usePathname();
  // Longest matching href wins so a detail/sub-route (e.g. /dashboard/profile,
  // or an admin inbox item at /admin/inbox/<id>) doesn't also light up a
  // shorter sibling link (e.g. /dashboard) that happens to be a path prefix.
  const activeHref = links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="fixed top-0 w-full z-40 bg-surface/95 backdrop-blur border-b border-outline-variant">
        {/* Full-bleed header (nav lives in the sidebar below, for both
            roles) so the logo sits flush left above the sidebar, matching
            the Stitch screens' header+sidebar shell. */}
        <div className="flex items-center justify-between px-margin-mobile md:px-margin-desktop py-3">
          <Link href={HOME_PATH[role]} className="shrink-0 flex items-center">
            <Logo priority />
          </Link>
          <div className="flex items-center gap-3">
            <p className="hidden sm:block text-label-md uppercase tracking-wider text-on-surface-variant whitespace-nowrap">
              {formatViewerName(viewerName)} · {role === "admin" ? "Admin" : "Client view"}
            </p>
            <ThemeToggle />
            <div className="flex items-center gap-1">
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <aside className="hidden md:flex flex-col fixed left-0 top-[65px] bottom-0 w-56 bg-surface-container-low border-r border-outline-variant py-4 z-30">
        <div className="px-4 pb-2">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">{SIDEBAR_LABEL[role]}</span>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-label-md ${
                activeHref === link.href
                  ? "bg-primary-container text-on-primary-container font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="animate-fade-in flex-grow pt-[72px] pb-[80px] md:pb-8 px-margin-mobile md:px-margin-desktop w-full flex flex-col gap-6 md:pl-56">
        <div className="max-w-container mx-auto w-full flex flex-col gap-6">{children}</div>
      </main>

      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-margin-mobile py-2 bg-surface border-t border-outline-variant">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center justify-center transition-opacity active:opacity-80 ${
              activeHref === link.href
                ? "text-primary font-bold bg-surface-container-highest rounded-xl px-3 py-1"
                : "text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined">{link.icon}</span>
            <span className="text-label-md-mobile uppercase tracking-wider mt-1">{link.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
