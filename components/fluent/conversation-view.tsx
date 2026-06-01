"use client";

import { useRef, useState } from "react";
import { Loader2, Send, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConversationTurn, EnglishLevel } from "@/lib/db/schema";

type ClientTurn = ConversationTurn & {
  audioBase64?: string | null;
};

type ConversationViewProps = {
  sessionId: string;
  topic: string;
  englishLevel: EnglishLevel;
  targetTurns: number;
  completedTurns: number;
  isComplete: boolean;
  initialTurns: ConversationTurn[];
};

function playAudio(base64: string) {
  const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
  void audio.play();
}

export function ConversationView({
  sessionId,
  topic,
  englishLevel,
  targetTurns,
  completedTurns,
  isComplete,
  initialTurns
}: ConversationViewProps) {
  const [turns, setTurns] = useState<ClientTurn[]>(initialTurns);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState({ completedTurns, targetTurns, isComplete });
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userText = text.trim();
    if (!userText || isSending || progress.isComplete) return;

    setText("");
    setError(null);
    setIsSending(true);

    const userTurn: ClientTurn = {
      role: "user",
      content: userText,
      timestamp: new Date().toISOString()
    };
    setTurns((current) => [...current, userTurn]);

    try {
      const response = await fetch("/api/conversation/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userText })
      });

      if (!response.ok) throw new Error("Alex could not answer. Try again.");

      const data = (await response.json()) as {
        turn: ClientTurn;
        session: { completedTurns: number; targetTurns: number; isComplete: boolean };
      };

      setTurns((current) => [...current, data.turn]);
      setProgress(data.session);
      if (data.turn.audioBase64) playAudio(data.turn.audioBase64);
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : "Something went wrong.");
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-3rem)] gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-lg border bg-white p-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <p className="text-sm font-medium text-muted-foreground">Practice session</p>
        <h1 className="mt-2 text-3xl font-semibold capitalize">{topic}</h1>
        <div className="mt-6 space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">Level</p>
            <p className="mt-1 font-medium">{englishLevel}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Progress</p>
            <p className="mt-1 font-medium">
              {progress.completedTurns} / {progress.targetTurns} user turns
            </p>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.min(100, (progress.completedTurns / progress.targetTurns) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="mt-1 font-medium">{progress.isComplete ? "Completed" : "Active"}</p>
          </div>
        </div>
      </aside>

      <main className="flex min-h-[calc(100vh-3rem)] flex-col rounded-lg border bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {turns.map((turn, index) => (
            <div key={`${turn.timestamp}-${index}`} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 ${
                  turn.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                <div className="flex items-start gap-3">
                  <p>{turn.content}</p>
                  {turn.role === "assistant" && turn.audioBase64 ? (
                    <button
                      type="button"
                      onClick={() => turn.audioBase64 && playAudio(turn.audioBase64)}
                      className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-white"
                      aria-label="Play audio"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {isSending ? (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Alex is replying
              </div>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="border-t p-4 md:p-6">
          {error ? <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-3">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={isSending || progress.isComplete}
              placeholder={progress.isComplete ? "Session completed" : "Reply in English..."}
              className="min-h-[84px] resize-none"
            />
            <Button type="submit" size="lg" disabled={isSending || !text.trim() || progress.isComplete} className="h-[84px] w-14 px-0">
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
