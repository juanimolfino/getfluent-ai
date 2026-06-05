import { notFound, redirect } from "next/navigation";
import { ConversationView } from "@/components/fluent/conversation-view";
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
    <ConversationView
      sessionId={session.id}
      topic={session.topic}
      englishLevel={session.englishLevel}
      targetTurns={session.targetTurns}
      completedTurns={session.completedTurns}
      isComplete={session.status === "completed" || session.status === "analyzed"}
      isPremium={isPremium}
      premiumSttProvider={process.env.NEXT_PUBLIC_PREMIUM_STT_PROVIDER}
      initialTurns={session.turns}
    />
  );
}
