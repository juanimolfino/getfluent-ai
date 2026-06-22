import Link from "next/link";
import type { ReactNode } from "react";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PRODUCTS,
  formatStripeUnitAmount,
  getConfiguredStripePriceMetadata,
  type PricingProductConfig,
  type StripePriceCreditMetadata
} from "@/lib/stripe/pricing";

export const metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

type PricingCardProps = {
  variant?: "default" | "feature" | "pack";
  name: string;
  tag?: string;
  price: string;
  cadence?: string;
  description: string;
  features?: readonly string[];
  credits?: string;
  cta: ReactNode;
};

function LogoMark({ id }: { id: string }) {
  return (
    <svg className="mark" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="13" fill={`url(#${id})`} />
      <path
        d="M8 13.5c1.4 1.6 3 2.4 5 2.4s3.6-.8 5-2.4"
        stroke="#3a2a55"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="26" y2="26">
          <stop stopColor="#E8DEF8" />
          <stop offset="1" stopColor="#FBE2D2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 12l3 3 5-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="none">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PricingCard({
  variant = "default",
  name,
  tag,
  price,
  cadence,
  description,
  features = [],
  credits,
  cta
}: PricingCardProps) {
  const className = ["pcard", variant === "feature" ? "feature" : "", variant === "pack" ? "pack" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={className}>
      {variant === "feature" ? <div className="blob" /> : null}
      {credits ? <span className="pc-credits">{credits}</span> : null}
      <div className="pc-top" style={credits ? { marginTop: 14 } : undefined}>
        <span className="pc-name">{name}</span>
        {tag ? <span className="pc-tag">{tag}</span> : null}
      </div>
      <div className="pc-price serif">
        {price}
        {cadence ? <small>{cadence}</small> : null}
      </div>
      <p className="pc-desc">{description}</p>
      {features.length ? (
        <ul className="pc-list">
          {features.map((feature) => (
            <li key={feature}>
              <CheckIcon />
              {feature}
            </li>
          ))}
        </ul>
      ) : null}
      {cta}
    </section>
  );
}

function CheckoutButton({
  mode,
  planId,
  packId,
  className,
  label
}: {
  mode: "subscription" | "credits";
  planId?: string;
  packId?: string;
  className: string;
  label: string;
}) {
  return (
    <form action="/api/stripe/checkout" method="post" className="pc-cta">
      <input type="hidden" name="mode" value={mode} />
      {planId ? <input type="hidden" name="planId" value={planId} /> : null}
      {packId ? <input type="hidden" name="packId" value={packId} /> : null}
      <button type="submit" className={className}>
        <CardIcon />
        {label}
      </button>
    </form>
  );
}

function ManageSubscriptionButton() {
  return (
    <form action="/api/stripe/portal" method="post">
      <button type="submit" className="btn btn-ghost btn-sm">
        <CardIcon />
        Manage subscription
      </button>
    </form>
  );
}

function displayPackName(name: string) {
  return name.replace(/^Pack\s+/, "");
}

async function loadStripeDisplayProduct(config: PricingProductConfig) {
  try {
    return { config, metadata: await getConfiguredStripePriceMetadata(config), error: null };
  } catch (error) {
    return {
      config,
      metadata: null,
      error: error instanceof Error ? error.message : "Stripe price metadata unavailable"
    };
  }
}

function displayPrice(metadata: StripePriceCreditMetadata | null) {
  if (!metadata) return "TBD";
  return formatStripeUnitAmount(metadata.unitAmount, metadata.currency);
}

function displayCredits(metadata: StripePriceCreditMetadata | null) {
  if (!metadata) return "Stripe metadata pending";
  return `${metadata.credits} credits`;
}

export default async function PricingPage() {
  const [subscriptionProducts, packProducts] = await Promise.all([
    Promise.all(SUBSCRIPTION_PRODUCTS.map(loadStripeDisplayProduct)),
    Promise.all(CREDIT_PACKS.map(loadStripeDisplayProduct))
  ]);

  return (
    <div className="gf-page gf-pricing">
      <header className="topbar">
        <div className="wrap topbar-in">
          <Link className="logo" href="/">
            <LogoMark id="gf-pricing-mark" />
            GetFluent
          </Link>
          <div className="pricing-actions">
            <ManageSubscriptionButton />
            <Link href="/practice" className="btn btn-ghost btn-sm">
              Back to practice
            </Link>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="wrap">
          <div className="page-head">
            <span className="eyebrow" style={{ justifyContent: "center", width: "100%" }}>
              <span className="dot" />
              Pricing
            </span>
            <h1 className="serif">
              Speak more. Pay <span className="it">less.</span>
            </h1>
            <p>
              Practice English with flexible credit packs or monthly plans. Start free - upgrade when Alex becomes
              part of your routine.
            </p>
          </div>

          <div className="plans">
            <PricingCard
              name="Free"
              price="$0"
              cadence="/mo"
              description="Try GetFluent with free credits."
              features={["5 free credits once", "Full voice practice", "Conversation analysis"]}
              cta={
                <button type="button" className="btn btn-ghost pc-cta" disabled>
                  Current plan
                </button>
              }
            />

            {subscriptionProducts.map(({ config, metadata }) => (
              <PricingCard
                key={config.id}
                variant={config.recommended ? "feature" : "default"}
                name={config.name}
                tag={config.recommended ? "Recommended" : undefined}
                credits={displayCredits(metadata)}
                price={displayPrice(metadata)}
                cadence="/mo"
                description={config.description}
                features={config.features}
                cta={
                  <CheckoutButton
                    mode="subscription"
                    planId={config.id}
                    className={config.recommended ? "btn btn-white pc-cta" : "btn btn-ghost pc-cta"}
                    label="Choose plan"
                  />
                }
              />
            ))}
          </div>

          <div className="packs-head">
            <h2 className="serif">
              Or grab a <span className="it">credit pack</span>
            </h2>
            <p>One-time packs that never expire. Perfect if you practice in bursts.</p>
          </div>

          <div className="packs">
            {packProducts.map(({ config, metadata }) => (
              <PricingCard
                key={config.id}
                variant="pack"
                name={displayPackName(config.name)}
                credits={displayCredits(metadata)}
                price={displayPrice(metadata)}
                description={config.description}
                cta={
                  <CheckoutButton
                    mode="credits"
                    packId={config.id}
                    className="btn btn-ghost pc-cta"
                    label="Buy pack"
                  />
                }
              />
            ))}
          </div>

          <div className="guarantee">
            <ShieldIcon />
            Cancel anytime · Credits never expire · No hidden fees
          </div>
        </div>
      </main>
    </div>
  );
}
