import Link from "next/link";
import { redirect } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { SetupForm } from "@/components/fluent/setup-form";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getRecentSessionStates } from "@/lib/conversation/session-state";
import { getUserLanguageProfile } from "@/lib/db/fluent-queries";
import { getDashboard } from "@/lib/db/queries";

export const metadata = { title: "Practice" };

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

function statusClass(status: string) {
  return status === "active" ? "active" : "done";
}

export default async function PracticePage() {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const [profile, sessions, dashboard] = await Promise.all([
    getUserLanguageProfile(user.id),
    getRecentSessionStates(user.id, 5),
    getDashboard(user.id)
  ]);

  return (
    <div className="gf-page gf-settings">
      <header className="topbar">
        <div className="wrap topbar-in">
          <Link className="logo" href="/dashboard">
            <LogoMark id="gf-settings-mark" />
            GetFluent
          </Link>
          <div className="right">
            <span className="credits">
              ◆ <b>{dashboard.credits}</b> free credits
            </span>
            <Link href="/pricing" className="btn btn-ghost btn-sm">
              Upgrade
            </Link>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="wrap">
          <div className="page-head">
            <h1 className="serif">
              Start a conversation <br />
              with <span className="it">Alex.</span>
            </h1>
            <p>Choose your level, topic, and length. Alex keeps it natural and adapts to your English.</p>
          </div>

          <div className="layout">
            <SetupForm profile={profile} />

            <aside className="panel side">
              <h3>
                <RefreshCw />
                Recent sessions
              </h3>
              {sessions.length ? (
                sessions.map((session) => (
                  <Link key={session.id} href={`/practice/${session.id}`} className="sess">
                    <div className="t">{session.topic}</div>
                    <div className="m">
                      {session.englishLevel} · {session.completedTurns}/{session.targetTurns} turns
                      <span className={`pill ${statusClass(session.status)}`}>{session.status}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="empty-sessions">Your completed and active conversations will appear here.</p>
              )}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
