import Link from "next/link";
import { ArrowRight, Headphones, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: MessageCircle, title: "Real conversation", body: "Alex keeps each session moving with natural follow-up questions around topics you actually care about." },
  { icon: Headphones, title: "Voice replies", body: "Listen to spoken answers so you can practice rhythm, pronunciation, and comprehension while you chat." },
  { icon: Sparkles, title: "Level-aware practice", body: "Sessions adapt from A1 basics to advanced debate without turning into a grammar lecture." }
];

export default function HomePage() {
  return (
    <main>
      <section className="border-b bg-white">
        <div className="mx-auto grid min-h-[86vh] max-w-6xl content-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center rounded-md border px-3 py-1 text-sm text-muted-foreground">
              English conversation practice
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-normal text-foreground md:text-7xl">
              Fluent
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Speak with Alex, an adaptive conversation partner that helps you build confidence in English through short, focused practice sessions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/login">
                  Start practicing <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="rounded-md bg-foreground p-5 text-sm text-white">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">A</div>
                <div>
                  <p className="font-semibold">Alex</p>
                  <p className="text-white/60">B1 · Travel practice</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="rounded-lg bg-white/10 p-3">What kind of trip would you like to take this year?</p>
                <p className="ml-auto max-w-[82%] rounded-lg bg-primary p-3 text-primary-foreground">I want to visit a city with good food and music.</p>
                <p className="rounded-lg bg-white/10 p-3">That sounds great. Would you prefer a busy city or a relaxed place near the sea?</p>
              </div>
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
            name: "Fluent",
            applicationCategory: "EducationalApplication",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
          })
        }}
      />
    </main>
  );
}
