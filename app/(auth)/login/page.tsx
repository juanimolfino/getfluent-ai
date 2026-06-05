import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="gf-page">
      <div className="auth">
        {/* LEFT — brand panel */}
        <aside className="brand-side">
          <div className="grain" />
          <div className="brand-top">
            <Link className="logo" href="/">
              <svg className="mark" viewBox="0 0 26 26" fill="none">
                <circle cx="13" cy="13" r="13" fill="url(#gf-login-mark)" />
                <path
                  d="M8 13.5c1.4 1.6 3 2.4 5 2.4s3.6-.8 5-2.4"
                  stroke="#3a2a55"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gf-login-mark" x1="0" y1="0" x2="26" y2="26">
                    <stop stopColor="#E8DEF8" />
                    <stop offset="1" stopColor="#FBE2D2" />
                  </linearGradient>
                </defs>
              </svg>
              GetFluent
            </Link>
            <Link className="back" href="/">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back home
            </Link>
          </div>

          <div className="brand-mid">
            <div className="alex-orb" style={{ width: 72, height: 72 }}>
              <div className="wave">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <h2 className="serif">
              Pick up right where you <span className="it">left off.</span>
            </h2>
          </div>

          <div className="quote">
            <p>
              &ldquo;It feels like talking to a patient friend who happens to be fluent. I stopped
              being scared of speaking.&rdquo;
            </p>
            <div className="by">
              <span className="av" />
              Lucía R. · practicing for B2 · 38-day streak
            </div>
          </div>
        </aside>

        {/* RIGHT — form panel */}
        <main className="form-side">
          <LoginForm initialMessage={error} />
        </main>
      </div>
    </div>
  );
}
