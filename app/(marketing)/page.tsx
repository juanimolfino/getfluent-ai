import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, WalletCards, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Workflow, title: "Async AI jobs", body: "Credit debit, durable job records, Inngest retries, and automatic refunds on failure." },
  { icon: WalletCards, title: "Dual billing", body: "One-time credit packs and monthly subscriptions can coexist without custom rewrites." },
  { icon: Sparkles, title: "Swappable AI APIs", body: "Providers live behind a small interface in /lib/ai/providers so each new micro-SaaS changes only the AI adapter." }
];

export default function HomePage() {
  return (
    <main>
      <section className="border-b bg-white">
        <div className="mx-auto grid min-h-[88vh] max-w-6xl content-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center rounded-md border px-3 py-1 text-sm text-muted-foreground">
              Production boilerplate for AI micro-SaaS
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-normal text-foreground md:text-7xl">
              AI SaaS Boilerplate
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Auth, credits, subscriptions, async jobs, AI provider adapters, transactional emails, and SEO are already connected so each new product starts at the feature layer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/login">
                  Start building <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="rounded-md bg-foreground p-4 font-mono text-sm text-white">
              <p className="text-teal-300">POST /api/jobs/create</p>
              <p className="mt-4 text-white/70">validate auth + credits</p>
              <p className="text-white/70">debit before execution</p>
              <p className="text-white/70">persist pending job</p>
              <p className="text-white/70">send event to Inngest</p>
              <p className="mt-4 text-orange-300">return {"{ jobId }"} immediately</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-16 md:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-lg border bg-card p-6">
            <feature.icon className="h-6 w-6 text-primary" />
            <h2 className="mt-5 text-xl font-semibold">{feature.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.body}</p>
          </article>
        ))}
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AI SaaS Boilerplate",
            applicationCategory: "DeveloperApplication",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
          })
        }}
      />
    </main>
  );
}
