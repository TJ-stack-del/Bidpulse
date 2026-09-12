import { MarketingShell } from "@/components/ui/MarketingShell";

// Mounts MarketingShell once for the whole public marketing site instead
// of each page doing it individually -- see MarketingShell.tsx's own
// comment for why that used to cause a full header/footer remount (and
// visible flash) on every navigation between marketing pages. This route
// group changes nothing about the actual URLs (/, /pricing, /faq, etc.).
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
