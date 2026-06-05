"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------
   GetFluent — Landing A (editorial)
   Recreated from docs/visual/.../design_handoff_landing_a/landing-a.html
   Shared design system + page styles live in app/globals.css under
   the `.gf-page` scope. Interactions (sticky-nav border, fade-up
   reveals) are reimplemented with React idioms.
------------------------------------------------------------------ */

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

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="currentColor">
      <path d="M3 10v4h4l5 5V5L7 10H3z" />
    </svg>
  );
}

const steps = [
  {
    tint: "pastel-lilac",
    num: "01",
    title: "Set your level & topic",
    body: "Pick A1 to C2, your native language, and what you feel like talking about — travel, work, gaming, or a random spark."
  },
  {
    tint: "pastel-peach",
    num: "02",
    title: "Speak with Alex",
    body: "Talk out loud with your mic. Pause and resume anytime. Alex replies by voice and text, keeping the conversation alive."
  },
  {
    tint: "pastel-sky",
    num: "03",
    title: "See what to improve",
    body: "End the session and get a clear analysis — then practice again with exercises shaped around how you actually spoke."
  }
];

const audience = [
  {
    tint: "pastel-sky",
    color: "var(--gf-sky-ink)",
    title: "Travelers",
    body: "Order, ask directions, and make small talk with confidence before you board.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M3 12l9-9 9 9M5 10v10h14V10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    tint: "pastel-lilac",
    color: "var(--gf-lilac-ink)",
    title: "Interviews",
    body: "Rehearse tough questions out loud so the real interview feels like a rerun.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  },
  {
    tint: "pastel-peach",
    color: "var(--gf-peach-ink)",
    title: "Students",
    body: "Turn classroom grammar into real speaking — the part textbooks never give you.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M4 19V5a1 1 0 011-1h11l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M8 9h6M8 13h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  },
  {
    tint: "pastel-mint",
    color: "var(--gf-mint-ink)",
    title: "Professionals",
    body: "Sharpen meeting, presentation, and email-call English on your own schedule.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M4 20c0-4 3.6-6 8-6s8 2 8 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
];

const faqs = [
  {
    q: "Do I need to speak out loud?",
    a: "Yes — that's the point. You talk with your mic and Alex listens, just like a real conversation. You can also type if you're somewhere quiet, but speaking is where the fluency comes from.",
    open: true
  },
  {
    q: "What if I make mistakes or get stuck?",
    a: "That's exactly what practice is for. Alex never judges — it keeps the conversation flowing with short, friendly questions, and you can pause and resume any time without losing what you said."
  },
  {
    q: "How does Alex match my level?",
    a: "You set your level from A1 to C2, and Alex adapts its vocabulary, speaking speed, and the type of questions it asks. Beginners get gentle, simple turns; advanced learners get debate and native pace."
  },
  {
    q: "What's included in the free plan?",
    a: "Full spoken conversations with Alex, in voice and text, plus basic progress tracking. Pro adds natural voice, one-tap translations, replay, and a detailed analysis at the end of each session."
  }
];

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="gf-page" ref={rootRef}>
      {/* NAV */}
      <header className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="wrap nav-in">
          <a className="logo" href="#top">
            <LogoMark id="gf-logo-nav" />
            GetFluent
          </a>
          <nav className="nav-links">
            <a href="#how">How it works</a>
            <a href="#who">Who it&apos;s for</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="nav-cta">
            <Link href="/login" className="btn btn-ghost btn-sm">
              Log in
            </Link>
            <Link href="/practice" className="btn btn-sm">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">
                <span className="dot" />
                Speak English, for real
              </span>
              <h1 className="serif">
                Talk your way to <span className="it">fluent.</span>
              </h1>
              <p className="sub">
                Real spoken conversations with Alex — an AI that listens, replies in a natural
                voice, and adapts to your level. No classes, no judgment.
              </p>
              <div className="hero-cta">
                <Link href="/practice" className="btn btn-lg">
                  Start a free conversation
                  <ArrowIcon />
                </Link>
                <a href="#how" className="btn btn-ghost btn-lg">
                  See how it works
                </a>
              </div>
              <div className="hero-note">
                <span className="live-dot" />
                <b>No credit card.</b>&nbsp;Your first session is on us.
              </div>
            </div>

            {/* chat demo */}
            <div className="demo">
              <div className="demo-head">
                <div className="alex-orb" style={{ width: 42, height: 42 }}>
                  <div className="wave">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className="meta">
                  <b>Alex</b>
                  <span>
                    <span className="live-dot" />
                    Listening · B2 · Travel
                  </span>
                </div>
              </div>
              <div className="demo-body">
                <div className="bub alex">
                  So, where are you dreaming of traveling next?
                  <span className="play">
                    <PlayIcon />
                    Play voice
                  </span>
                </div>
                <div className="bub user">Maybe Japan! I want to practice before my trip.</div>
                <div className="bub alex">
                  Nice choice. What&apos;s the first thing you&apos;d want to do when you land in
                  Tokyo?
                  <span className="play">
                    <PlayIcon />
                    Play voice
                  </span>
                </div>
              </div>
              <div className="demo-bar">
                <div className="mic">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                    <path
                      d="M5 11a7 7 0 0014 0M12 18v3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="mic-eq">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <i key={i} />
                  ))}
                </div>
                <span className="send-pill">Tap to send</span>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST */}
        <section className="trust">
          <div className="wrap trust-in">
            <span>
              <span className="stars">★★★★★</span> &nbsp;4.9 average from early learners
            </span>
            <span>·</span>
            <span>14,000+ conversations practiced</span>
            <span>·</span>
            <span>Speaks at A1 → C2</span>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="sec" id="how">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">
                <span className="dot" />
                How it works
              </span>
              <h2 className="serif">
                Three steps to your <span className="it">first chat.</span>
              </h2>
              <p>
                Set it up once, then just talk. Alex handles the rest — pace, vocabulary, and the
                questions that keep you going.
              </p>
            </div>
            <div className="steps">
              {steps.map((s) => (
                <div className="step reveal" key={s.num}>
                  <div className={`tint ${s.tint}`} />
                  <div className="num">{s.num}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="sec audience" id="who">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">
                <span className="dot" />
                Who it&apos;s for
              </span>
              <h2 className="serif">
                Practice for the moment <span className="it">that matters.</span>
              </h2>
              <p>
                From the comfort of your home, rehearse the conversations you&apos;ll actually have —
                at your level, on your topics.
              </p>
            </div>
            <div className="aud-grid">
              {audience.map((a) => (
                <div className="aud reveal" key={a.title}>
                  <div className={`ico ${a.tint}`} style={{ color: a.color }}>
                    {a.icon}
                  </div>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="sec" id="pricing">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">
                <span className="dot" />
                Pricing
              </span>
              <h2 className="serif">
                Start free. Go <span className="it">Pro</span> when you&apos;re hooked.
              </h2>
              <p>
                Try a full conversation for free. Upgrade for natural voice, translations, repeat
                audio, and end-of-session analysis.
              </p>
            </div>
            <div className="plans">
              <div className="plan reveal">
                <div className="pname">Free</div>
                <div className="price serif">$0</div>
                <div className="per">to get started</div>
                <ul>
                  <li>
                    <CheckIcon />
                    Full practice conversations
                  </li>
                  <li>
                    <CheckIcon />
                    Voice &amp; text with Alex
                  </li>
                  <li>
                    <CheckIcon />
                    Basic progress tracking
                  </li>
                </ul>
                <Link
                  href="/practice"
                  className="btn btn-ghost"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Start free
                </Link>
              </div>
              <div className="plan pro reveal">
                <span className="badge">Most popular</span>
                <div className="pname">Pro</div>
                <div className="price serif">$9</div>
                <div className="per">per month</div>
                <ul>
                  <li>
                    <CheckIcon />
                    Natural, human-like voice
                  </li>
                  <li>
                    <CheckIcon />
                    Translate &amp; replay any message
                  </li>
                  <li>
                    <CheckIcon />
                    End-of-session analysis
                  </li>
                  <li>
                    <CheckIcon />
                    Longer sessions &amp; 100 credits/mo
                  </li>
                </ul>
                <Link
                  href="/pricing"
                  className="btn btn-white"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec audience" id="faq">
          <div className="wrap">
            <div className="sec-head center reveal" style={{ margin: "0 auto" }}>
              <span className="eyebrow" style={{ justifyContent: "center", width: "100%" }}>
                <span className="dot" />
                FAQ
              </span>
              <h2 className="serif">
                Questions, <span className="it">answered.</span>
              </h2>
            </div>
            <div className="faq">
              {faqs.map((f) => (
                <details className="qa" key={f.q} open={f.open}>
                  <summary>
                    {f.q}
                    <span className="pm" />
                  </summary>
                  <div className="ans">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final">
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="wrap" style={{ position: "relative", zIndex: 2 }}>
            <div
              className="alex-orb"
              style={{ width: 80, height: 80, margin: "0 auto 28px" }}
            >
              <div className="wave">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <h2 className="serif">
              Your first conversation
              <br />
              is <span className="it">waiting.</span>
            </h2>
            <p>
              Speak English from the comfort of home — without the fear of getting it wrong.
            </p>
            <div className="hero-cta">
              <Link href="/practice" className="btn btn-lg">
                Start free with Alex
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="foot">
        <div className="wrap foot-in">
          <div style={{ maxWidth: 280 }}>
            <a className="logo" href="#top">
              <LogoMark id="gf-logo-foot" />
              GetFluent
            </a>
            <p className="muted" style={{ fontSize: 15, marginTop: 14 }}>
              Speak English with Alex. Practice the conversations that matter, at your level.
            </p>
          </div>
          <div className="foot-cols">
            <div className="foot-col">
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
              <Link href="/practice">The chat</Link>
            </div>
            <div className="foot-col">
              <h4>Practice</h4>
              <a href="#who">Travelers</a>
              <a href="#who">Interviews</a>
              <a href="#who">Students</a>
            </div>
            <div className="foot-col">
              <h4>Account</h4>
              <Link href="/login">Log in</Link>
              <Link href="/practice">Start free</Link>
            </div>
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 40, fontSize: 13.5, color: "var(--gf-ink-3)" }}>
          © 2026 GetFluent · Made for people who&apos;d rather talk than study.
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "GetFluent",
            applicationCategory: "EducationalApplication",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
          })
        }}
      />
    </div>
  );
}
