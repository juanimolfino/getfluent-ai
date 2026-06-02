import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { SetupForm } from "@/components/fluent/setup-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getRecentSessionStates } from "@/lib/conversation/session-state";
import { getUserLanguageProfile } from "@/lib/db/fluent-queries";

export const metadata = { title: "Practice" };

export default async function PracticePage() {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const [profile, sessions] = await Promise.all([
    getUserLanguageProfile(user.id),
    getRecentSessionStates(user.id, 5)
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Button asChild variant="ghost" className="mb-4 px-0">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          </Button>
          <Badge className="bg-white">Fluent practice</Badge>
          <h1 className="mt-3 text-4xl font-semibold">Start a conversation with Alex</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Choose your level, topic, and session length. Alex keeps the conversation natural and adapts to your English.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border bg-card p-5 md:p-6">
          <SetupForm profile={profile} />
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-white p-5">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Recent sessions</h2>
            </div>
            <div className="mt-4 space-y-3">
              {sessions.length ? sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/practice/${session.id}`}
                  className="block rounded-md border bg-background p-3 transition-colors hover:bg-muted"
                >
                  <p className="font-medium capitalize">{session.topic}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {session.englishLevel} · {session.completedTurns}/{session.targetTurns} turns · {session.status}
                  </p>
                </Link>
              )) : (
                <p className="text-sm leading-6 text-muted-foreground">Your completed and active conversations will appear here.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
