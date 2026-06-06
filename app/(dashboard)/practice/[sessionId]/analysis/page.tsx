import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AnalysisView } from "@/components/exercises/AnalysisView";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSessionState } from "@/lib/conversation/session-state";
import { getConversationAnalysisBySession } from "@/lib/db/fluent-queries";

export const metadata = { title: "Conversation analysis" };

type AnalysisPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const { sessionId } = await params;
  const [session, initialAnalysis] = await Promise.all([
    getSessionState(sessionId, user.id),
    getConversationAnalysisBySession(sessionId, user.id)
  ]);
  if (!session) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href={`/practice/${session.id}`}
        className="mb-4 inline-flex items-center gap-2 rounded-full px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Conversation
      </Link>

      <AnalysisView sessionId={session.id} topic={session.topic} initialAnalysis={initialAnalysis} />
    </main>
  );
}
