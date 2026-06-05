"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 7l8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={19} height={19}>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1A6.2 6.2 0 015.8 12 6.2 6.2 0 0112 5.8c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.1 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}

function CheckBadge() {
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

type Status = "idle" | "submitting" | "sent" | "error";

export function LoginForm({ initialMessage }: { initialMessage?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(initialMessage ? "error" : "idle");
  const [error, setError] = useState<string | null>(initialMessage ?? null);

  async function signInWithMagicLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    setStatus("submitting");
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` }
    });
    if (otpError) {
      setStatus("error");
      setError(otpError.message);
      return;
    }
    setStatus("sent");
  }

  function signInWithGoogle() {
    window.location.href = "/login/google";
  }

  function reset() {
    setStatus("idle");
    setError(null);
  }

  return (
    <div className="form-box">
      <h1 className="lead serif">
        Welcome <span className="it">back.</span>
      </h1>
      <p className="desc">Sign in with a magic link or Google to keep practicing with Alex.</p>

      {status === "sent" ? (
        <>
          <div className="auth-note">
            <CheckBadge />
            <span>
              <b>Check your inbox.</b> We sent a magic link to {email || "your email"}. Click it to
              keep practicing with Alex.
            </span>
          </div>
          <button type="button" className="auth-reset" onClick={reset}>
            ← Use a different email
          </button>
        </>
      ) : (
        <>
          <form onSubmit={signInWithMagicLink}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button
              className="btn btn-lg btn-full"
              type="submit"
              disabled={status === "submitting"}
            >
              <MailIcon />
              {status === "submitting" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && error ? <p className="auth-error">{error}</p> : null}
          </form>

          <div className="or">or</div>

          <button type="button" className="btn btn-white btn-lg g-btn" onClick={signInWithGoogle}>
            <GoogleIcon />
            Continue with Google
          </button>
        </>
      )}

      <p className="legal">
        By continuing you agree to GetFluent&apos;s <a href="#">Terms</a> and{" "}
        <a href="#">Privacy Policy</a>.
      </p>
    </div>
  );
}
