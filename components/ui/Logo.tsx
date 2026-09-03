import Image from "next/image";

// Shared nav wordmark, used everywhere a nav bar shows the BidPulse mark
// (AppShell, MarketingShell's header + footer, the intake wizard's header).
// Height is set once via --nav-logo-height (app/globals.css) rather than
// each caller picking its own h-8/h-9/h-10 by eye -- that's exactly how it
// drifted to three different rendered heights before this existed.
// Renders both the light-bg and dark-bg variants (matching whichever the
// active theme needs via dark:hidden/dark:block) since every nav context
// this is used in supports the light/dark toggle -- not just the one
// variant a single screenshot happened to show.
//
// Only the horizontal nav mark (logo.svg/logo-dark.svg) -- the stacked
// mark used on login/reset-password is a different, deliberately taller
// centerpiece treatment, not a nav instance, and out of scope here.
export function Logo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <>
      <Image
        src="/logo.svg"
        alt="BidPulse"
        width={99}
        height={22}
        className={`h-[var(--nav-logo-height)] w-auto dark:hidden ${className}`}
        priority={priority}
      />
      <Image
        src="/logo-dark.svg"
        alt="BidPulse"
        width={99}
        height={22}
        className={`hidden h-[var(--nav-logo-height)] w-auto dark:block ${className}`}
        priority={priority}
      />
    </>
  );
}
