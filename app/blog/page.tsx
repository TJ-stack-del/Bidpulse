import { MarketingShell } from "@/components/ui/MarketingShell";

// No CMS or posts table exists yet — static entries for now, matching
// BUILD-ORDER-SPECWRIGHT.md's "start simple." No individual post routes
// until there's real content to link to.

const POSTS = [
  {
    title: "Five things to check before submitting a bid",
    date: "2026-08-01",
    excerpt:
      "A last-pass checklist covering the details agencies actually reject bids over — page limits, required forms, and signature pages.",
  },
  {
    title: "Why a compliance matrix matters more than your pitch",
    date: "2026-07-18",
    excerpt:
      "Evaluators score against the RFP's requirements line by line. A clear compliance matrix makes that scoring easy — and easy to score well.",
  },
];

export default function BlogPage() {
  return (
    <MarketingShell activePath="/blog">
      <section className="max-w-2xl mx-auto w-full flex flex-col gap-8">
        <h1 className="text-headline-lg text-on-surface text-center">Blog</h1>
        <div className="flex flex-col gap-6">
          {POSTS.map((post) => (
            <article
              key={post.title}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6"
            >
              <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
                {new Date(post.date).toLocaleDateString()}
              </p>
              <h2 className="text-title-lg text-on-surface mb-2">{post.title}</h2>
              <p className="text-body-md text-on-surface-variant">{post.excerpt}</p>
            </article>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
