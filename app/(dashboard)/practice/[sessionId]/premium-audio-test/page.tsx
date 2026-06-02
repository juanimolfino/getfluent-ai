import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PremiumAudioTest } from "@/components/fluent/premium-audio-test";
import { Button } from "@/components/ui/button";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSessionState } from "@/lib/conversation/session-state";

export const metadata = { title: "Premium audio test" };

type PremiumAudioTestPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function PremiumAudioTestPage({ params }: PremiumAudioTestPageProps) {
  const user = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const { sessionId } = await params;
  const session = await getSessionState(sessionId, user.id);
  if (!session) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Button asChild variant="ghost" className="mb-4 px-0">
        <Link href={`/practice/${session.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Conversation
        </Link>
      </Button>
      <PremiumAudioTest sessionId={session.id} />
    </main>
  );
}
