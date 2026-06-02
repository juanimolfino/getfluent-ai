import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSessionState } from "@/lib/conversation/session-state";

export const metadata = { title: "Conversation analysis" };

type AnalysisPageProps = {
  params: Promise<{ sessionId: string }>;
};

// Placeholder analysis screen so completed Fase A sessions never end on a broken route.
export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const { sessionId } = await params;
  const session = await getSessionState(sessionId, user.id);
  if (!session) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Button asChild variant="ghost" className="mb-4 px-0">
        <Link href={`/practice/${session.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Conversation
        </Link>
      </Button>

      <section className="rounded-lg border bg-white p-6">
        <p className="text-sm font-medium text-muted-foreground">Analysis</p>
        <h1 className="mt-2 text-3xl font-semibold capitalize">{session.topic}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The transcript is ready. The personalized analysis flow will use this conversation in the next implementation pass.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        {session.turns.map((turn, index) => (
          <article key={`${turn.timestamp}-${index}`} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{turn.role === "assistant" ? "Alex" : "You"}</p>
            <p className="mt-2 text-sm leading-6">{turn.content}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
