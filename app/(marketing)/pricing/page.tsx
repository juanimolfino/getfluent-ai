import Link from "next/link";
import { CheckCircle2, CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CREDIT_PACKS, PLANS } from "@/lib/stripe/pricing";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-semibold">Pricing</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Sell monthly plans and non-expiring credit packs at the same time.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((plan) => (
          <section key={plan.id} className="rounded-lg border bg-card p-6">
            <h2 className="text-2xl font-semibold">{plan.name}</h2>
            <p className="mt-2 text-3xl font-semibold">${plan.priceMonthly}<span className="text-base text-muted-foreground">/mo</span></p>
            <ul className="mt-6 space-y-3 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            {plan.id === "pro" ? (
              <form action="/api/stripe/checkout" method="post" className="mt-6">
                <input type="hidden" name="mode" value="subscription" />
                <Button type="submit" className="w-full">
                  <CreditCard className="h-4 w-4" />
                  Upgrade to Pro
                </Button>
              </form>
            ) : (
              <Button disabled variant="outline" className="mt-6 w-full">
                Current starter plan
              </Button>
            )}
          </section>
        ))}
      </div>
      <h2 className="mt-12 text-2xl font-semibold">Credit packs</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <section key={pack.id} className="rounded-lg border bg-card p-6">
            <h3 className="text-xl font-semibold">{pack.credits} credits</h3>
            <p className="mt-2 text-3xl font-semibold">${pack.price}</p>
            <p className="mt-3 text-sm text-muted-foreground">Credits do not expire.</p>
            <form action="/api/stripe/checkout" method="post" className="mt-6">
              <input type="hidden" name="mode" value="credits" />
              <input type="hidden" name="packId" value={pack.id} />
              <Button type="submit" className="w-full">
                <Wallet className="h-4 w-4" />
                Buy {pack.credits} credits
              </Button>
            </form>
          </section>
        ))}
      </div>
    </main>
  );
}
