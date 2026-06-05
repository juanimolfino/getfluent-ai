import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardAutoRefresh } from "@/components/dashboard/dashboard-auto-refresh";
import { getRecentSessionStates } from "@/lib/conversation/session-state";
import { getDashboard, ensureUserProfile } from "@/lib/db/queries";
import { getUserLanguageProfile } from "@/lib/db/fluent-queries";
import type { ConversationSession } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

const QUICK_TOPICS = ["Gaming", "Travel", "Interviews", "Football"];
const DOT_CLASSES = ["pastel-lilac", "pastel-sky", "pastel-peach", "pastel-mint"];

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
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 10h4M7 14h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CreditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7v10M9.5 9.2c0-1 .9-1.7 2.4-1.7s2.4.7 2.4 1.7-1 1.5-2.4 1.7-2.4.7-2.4 1.7.9 1.7 2.4 1.7 2.4-.7 2.4-1.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 4v16h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 14l3-3 3 2 4-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M21 11.5a8.4 8.4 0 01-9 8.4L3 21l1.1-3.4A8.4 8.4 0 1121 11.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 12l9-9 9 9M5 10v10h14V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function displayName(fullName: string | null, email: string) {
  const raw = fullName?.trim() || email.split("@")[0] || "there";
  return raw.split(/\s+/)[0];
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

function relativeDate(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  return `${diffWeeks} weeks ago`;
}

function formatRenewal(date: Date | null | undefined) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function estimateConversations(credits: number) {
  return Math.max(0, Math.floor(credits / 8));
}

function sessionsThisWeek(sessions: ConversationSession[]) {
  const weekAgo = Date.now() - 7 * 86_400_000;
  return sessions.filter((session) => session.createdAt.getTime() >= weekAgo).length;
}

function minutesSpoken(sessions: ConversationSession[]) {
  return Math.round(sessions.reduce((total, session) => total + session.sttAudioMsUsed, 0) / 60_000);
}

function currentStreak(sessions: ConversationSession[]) {
  const days = new Set(sessions.map((session) => session.createdAt.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function sessionIcon(topic: string, index: number) {
  const lower = topic.toLowerCase();
  if (lower.includes("interview") || lower.includes("business") || lower.includes("job")) return { icon: <BriefcaseIcon />, tone: "pastel-peach", color: "peach" };
  if (lower.includes("travel") || lower.includes("home") || lower.includes("place")) return { icon: <HomeIcon />, tone: "pastel-sky", color: "sky" };
  if (index % 3 === 1) return { icon: <BriefcaseIcon />, tone: "pastel-peach", color: "peach" };
  if (index % 3 === 2) return { icon: <HomeIcon />, tone: "pastel-sky", color: "sky" };
  return { icon: <ChatIcon />, tone: "pastel-lilac", color: "lilac" };
}

function statusLabel(status: ConversationSession["status"]) {
  if (status === "active") return "Active";
  return "Completed";
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await ensureUserProfile(user);
  const [dashboard, sessions, languageProfile] = await Promise.all([
    getDashboard(profile.id),
    getRecentSessionStates(profile.id, 10),
    getUserLanguageProfile(profile.id)
  ]);

  const recentSessions = sessions.slice(0, 3);
  const activeSession = sessions.find((session) => session.status === "active");
  const renewal = formatRenewal(dashboard.subscription?.currentPeriodEnd);
  const plan = dashboard.subscription?.plan ?? "free";
  const subscriptionStatus = dashboard.subscription?.status ?? "active";
  const streak = currentStreak(sessions);
  const weekSessions = sessionsThisWeek(sessions);
  const spokenMinutes = minutesSpoken(sessions);
  const quickTopics = languageProfile?.preferredTopics?.length ? languageProfile.preferredTopics.slice(0, 4).map(titleCase) : QUICK_TOPICS;

  return (
    <div className="gf-page gf-dashboard">
      <DashboardAutoRefresh statuses={dashboard.jobs.map((job) => job.status)} />
      <header className="topbar">
        <div className="wrap topbar-in">
          <Link className="logo" href="/dashboard">
            <LogoMark id="gf-dashboard-mark" />
            GetFluent
          </Link>
          <div className="right">
            <Link className="iconlink" href="/pricing">
              <CardIcon />
              Buy credits
            </Link>
            <form action="/api/stripe/portal" method="post">
              <button className="iconlink" type="submit">
                <BillingIcon />
                Billing
              </button>
            </form>
            <form action="/logout" method="post">
              <button className="iconlink" type="submit">
                <LogoutIcon />
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="wrap">
          <section className="greet">
            <div className="gcol">
              <h1 className="serif">
                Welcome back, <span className="it">{displayName(profile.fullName, profile.email)}.</span>
              </h1>
              <p className="who">
                <span className="av"></span>
                {profile.email}
              </p>
            </div>
            <Link href="/practice" className="btn btn-lg">
              Start practicing
              <ArrowIcon />
            </Link>
          </section>

          <section className="stats">
            <div className="stat">
              <div className="tint pastel-lilac"></div>
              <div className="k">
                <CreditIcon />
                Credit balance
              </div>
              <div className="v">{dashboard.credits}</div>
              <div className="sub">≈ {estimateConversations(dashboard.credits)} more conversations</div>
            </div>

            <div className="stat">
              <div className="k">
                <CheckIcon />
                Subscription
              </div>
              <div className="v plan-value">{titleCase(plan)}</div>
              <div className="pillrow">
                <span className="badge live">
                  <span className="d"></span>
                  {titleCase(subscriptionStatus)}
                </span>
                {renewal ? <span className="sub renewal">renews {renewal}</span> : null}
              </div>
            </div>

            <div className="stat">
              <div className="tint pastel-peach"></div>
              <div className="k">
                <BoltIcon />
                Current streak
              </div>
              <div className="v">
                {streak}
                <small> days</small>
              </div>
              <div className="sub">Keep the rhythm going</div>
            </div>

            <div className="stat">
              <div className="tint pastel-sky"></div>
              <div className="k">
                <ChartIcon />
                This week
              </div>
              <div className="v">
                {weekSessions}
                <small> sessions</small>
              </div>
              <div className="sub">~{spokenMinutes} min speaking</div>
            </div>
          </section>

          <section className="grid">
            <div className="practice">
              <div className="blob b1"></div>
              <div className="practice-in">
                <div className="copy">
                  <h2 className="serif">
                    Practice with <span className="it">Alex</span>
                  </h2>
                  <p>
                    Start a guided English conversation by choosing your level, interests, and topic. Alex replies in a
                    natural voice and adapts as you go.
                  </p>
                  <div className="cta-row">
                    <Link href="/practice" className="btn">
                      <ChatIcon />
                      New conversation
                    </Link>
                    {activeSession ? (
                      <Link href={`/practice/${activeSession.id}`} className="resume">
                        or resume <b>&ldquo;{titleCase(activeSession.topic)}&rdquo;</b>
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="orb-wrap">
                  <div className="alex-orb large-orb">
                    <div className="wave">
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="quick">
              <h3>
                <BoltIcon />
                Jump back in
              </h3>
              <p className="sub">Start a quick session on a familiar topic.</p>
              <div className="qchips">
                {quickTopics.map((topic, index) => (
                  <Link key={topic} href="/practice" className="qchip">
                    <span className={`dot ${DOT_CLASSES[index % DOT_CLASSES.length]}`}></span>
                    {topic}
                  </Link>
                ))}
                <Link href="/practice" className="qchip surprise">
                  ✦ Surprise me
                </Link>
              </div>
            </div>
          </section>

          <section className="section-h">
            <h2 className="serif">
              Recent <span className="it">conversations</span>
            </h2>
            <Link href="/practice">View all →</Link>
          </section>

          {recentSessions.length ? (
            <section className="sessions">
              {recentSessions.map((session, index) => {
                const icon = sessionIcon(session.topic, index);
                const progress = Math.min(100, Math.round((session.completedTurns / session.targetTurns) * 100));

                return (
                  <Link key={session.id} className="scard" href={`/practice/${session.id}`}>
                    <div className="top">
                      <div className={`ico ${icon.tone} ${icon.color}`}>{icon.icon}</div>
                      <span className={`pill ${session.status === "active" ? "active" : "done"}`}>{statusLabel(session.status)}</span>
                    </div>
                    <h3>{titleCase(session.topic)}</h3>
                    <div className="meta">
                      {session.englishLevel} · {session.completedTurns} / {session.targetTurns} turns · {relativeDate(session.createdAt)}
                    </div>
                    <div className="barwrap">
                      <i style={{ width: `${progress}%` }}></i>
                    </div>
                  </Link>
                );
              })}
            </section>
          ) : (
            <section className="empty">Your completed and active conversations will appear here.</section>
          )}
        </div>
      </main>
    </div>
  );
}
