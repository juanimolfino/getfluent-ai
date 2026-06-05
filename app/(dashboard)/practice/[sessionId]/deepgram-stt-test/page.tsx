import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeepgramSttTest } from "@/components/fluent/deepgram-stt-test";
import { Button } from "@/components/ui/button";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { isPremiumUser } from "@/lib/billing/tier";
import { getSessionState } from "@/lib/conversation/session-state";

export const metadata = { title: "Deepgram STT test" };

type DeepgramSttTestPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function DeepgramSttTestPage({ params }: DeepgramSttTestPageProps) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const { sessionId } = await params;
  const session = await getSessionState(sessionId, user.id);
  if (!session) notFound();

  const isPremium = await isPremiumUser(user.id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Button asChild variant="ghost" className="mb-4 px-0">
        <Link href={`/practice/${session.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Conversation
        </Link>
      </Button>

      {isPremium ? (
        <DeepgramSttTest sessionId={session.id} />
      ) : (
        <section className="rounded-lg border bg-white p-5">
          <h1 className="text-2xl font-semibold">Deepgram STT test</h1>
          <p className="mt-2 text-sm text-muted-foreground">This diagnostic is only available for Pro users.</p>
        </section>
      )}
    </main>
  );
}
