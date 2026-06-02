import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConversationView } from "@/components/fluent/conversation-view";
import { Button } from "@/components/ui/button";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { isPremiumUser } from "@/lib/billing/tier";
import { getSessionState } from "@/lib/conversation/session-state";

export const metadata = { title: "Conversation" };

type ConversationPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function ConversationPage({ params }: ConversationPageProps) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const { sessionId } = await params;
  const session = await getSessionState(sessionId, user.id);
  if (!session) notFound();
  const isPremium = await isPremiumUser(user.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <Button asChild variant="ghost" className="mb-4 px-0">
        <Link href="/practice"><ArrowLeft className="h-4 w-4" /> Practice setup</Link>
      </Button>
      <ConversationView
        sessionId={session.id}
        topic={session.topic}
        englishLevel={session.englishLevel}
        targetTurns={session.targetTurns}
        completedTurns={session.completedTurns}
        isComplete={session.status === "completed" || session.status === "analyzed"}
        isPremium={isPremium}
        initialTurns={session.turns}
      />
    </main>
  );
}
