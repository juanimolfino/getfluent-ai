import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ExerciseSetView } from "@/components/exercises/ExerciseSetView";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSessionState, hasPaidConversationCredit } from "@/lib/conversation/session-state";
import { getConversationAnalysisById, getExerciseSetByWeakPoint } from "@/lib/db/fluent-queries";

export const metadata = { title: "Practice point" };

type PracticePointPageProps = {
  params: Promise<{ sessionId: string; analysisId: string; weakPointId: string }>;
};

export default async function PracticePointPage({ params }: PracticePointPageProps) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const { sessionId, analysisId, weakPointId } = await params;
  const [session, analysis, initialExerciseSet] = await Promise.all([
    getSessionState(sessionId, user.id),
    getConversationAnalysisById(analysisId, user.id),
    getExerciseSetByWeakPoint({ analysisId, weakPointId, userId: user.id })
  ]);
  const analysisBelongsToSession = Boolean(session && analysis && analysis.sessionId === session.id);
  const paidSession = hasPaidConversationCredit(session);
  const weakPointExists = analysisBelongsToSession && (analysis?.weakPoints.some((point) => point.id === weakPointId) ?? false);

  if (!session || !paidSession || !analysis || !analysisBelongsToSession || !weakPointExists) {
    const reason = !session
      ? "Session not found for your user."
      : !paidSession
        ? "This practice session has no paid credit attached."
        : !analysis
          ? "Analysis not found for your user."
          : !analysisBelongsToSession
            ? "Analysis does not belong to this session."
            : "Practice point not found in this analysis.";

    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Link
          href={`/practice/${sessionId}/analysis`}
          className="mb-4 inline-flex items-center gap-2 rounded-full px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to analysis
        </Link>

        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-8">
          <p className="text-sm font-semibold text-amber-700">Practice point unavailable</p>
          <h1 className="mt-3 text-2xl font-semibold text-amber-950">{reason}</h1>
          <p className="mt-3 text-sm leading-6 text-amber-900">
            Open the analysis again and choose one of the current practice cards. If this came from a fresh card, the
            session may be using a different browser login.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href={`/practice/${sessionId}/analysis`}
        className="mb-4 inline-flex items-center gap-2 rounded-full px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to analysis
      </Link>

      <ExerciseSetView
        sessionId={sessionId}
        analysisId={analysisId}
        weakPointId={weakPointId}
        initialExerciseSet={initialExerciseSet}
      />
    </main>
  );
}
