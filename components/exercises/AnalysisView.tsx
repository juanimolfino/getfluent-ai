"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, MessageCircle, Mic, Sparkles, TrendingUp } from "lucide-react";
import type { ConversationAnalysis } from "@/lib/db/schema";
import type { WeakPointCategory } from "@/lib/exercises/analysis";

type AnalysisViewProps = {
  sessionId: string;
  topic: string;
  initialAnalysis: ConversationAnalysis | null;
};

type AnalyzeResponse = {
  analysis: ConversationAnalysis;
};

const analysisCache = new Map<string, ConversationAnalysis>();
const analysisRequestCache = new Map<string, Promise<ConversationAnalysis>>();

const CATEGORY_META: Record<WeakPointCategory, { label: string; icon: typeof BookOpen; tone: string }> = {
  grammar: { label: "Grammar", icon: BookOpen, tone: "text-blue-700 bg-blue-50 border-blue-100" },
  vocabulary: { label: "Vocabulary", icon: Sparkles, tone: "text-purple-700 bg-purple-50 border-purple-100" },
  fluency: { label: "Fluency", icon: TrendingUp, tone: "text-amber-700 bg-amber-50 border-amber-100" },
  pronunciation: { label: "Pronunciation", icon: Mic, tone: "text-emerald-700 bg-emerald-50 border-emerald-100" }
};

export function AnalysisView({ sessionId, topic, initialAnalysis }: AnalysisViewProps) {
  const cachedInitialAnalysis = initialAnalysis ?? analysisCache.get(sessionId) ?? null;
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(cachedInitialAnalysis);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!cachedInitialAnalysis);

  useEffect(() => {
    const cached = initialAnalysis ?? analysisCache.get(sessionId);
    if (cached) {
      analysisCache.set(sessionId, cached);
      setAnalysis(cached);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAnalysis() {
      setIsLoading(true);
      setError(null);

      try {
        let request = analysisRequestCache.get(sessionId);
        if (!request) {
          request = fetch("/api/conversation/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId })
          }).then(async (response) => {
            if (!response.ok) throw new Error("No pudimos analizar la conversación todavía.");
            const data = (await response.json()) as AnalyzeResponse;
            analysisCache.set(sessionId, data.analysis);
            return data.analysis;
          }).finally(() => {
            analysisRequestCache.delete(sessionId);
          });
          analysisRequestCache.set(sessionId, request);
        }

        const nextAnalysis = await request;
        if (!cancelled) setAnalysis(nextAnalysis);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Algo salió mal.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadAnalysis();
    return () => {
      cancelled = true;
    };
  }, [sessionId, initialAnalysis]);

  if (isLoading) {
    return (
      <section className="rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-purple-700">Analysis</p>
        <h1 className="mt-3 text-3xl font-semibold">Tu profesor está revisando la conversación...</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Buscando ejemplos reales de lo que dijiste y transformándolos en práctica concreta.
        </p>
      </section>
    );
  }

  if (error || !analysis) {
    return (
      <section className="rounded-3xl border border-red-100 bg-red-50 p-8">
        <p className="text-sm font-semibold text-red-700">Analysis unavailable</p>
        <h1 className="mt-3 text-3xl font-semibold text-red-950">{error ?? "No analysis found."}</h1>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-gradient-to-br from-purple-50 to-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-purple-700">Analysis · {topic}</p>
        <h1 className="mt-3 text-3xl font-semibold">Great work. Here is what to practice next.</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{analysis.encouragement}</p>
      </section>

      {analysis.weakPoints.length ? (
        <section className="grid gap-4">
          {analysis.weakPoints.map((weakPoint) => {
            const meta = CATEGORY_META[weakPoint.category];
            const Icon = meta.icon;

            return (
              <article key={weakPoint.id} className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${meta.tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <h2 className="mt-4 text-2xl font-semibold">{weakPoint.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{weakPoint.explanation}</p>
                  </div>
                  <Link
                    href={`/practice/${sessionId}/analysis/${analysis.id}/${weakPoint.id}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Practice this
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700">You said</p>
                    <p className="mt-2 text-sm leading-6 text-red-950">{weakPoint.userExample}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Better</p>
                    <p className="mt-2 text-sm leading-6 text-emerald-950">{weakPoint.betterVersion}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">No big weak points this time.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            The conversation was either short or clear enough that there is nothing specific to drill yet. Do one more
            conversation and Alex will have more material to analyze.
          </p>
          <Link href="/practice" className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            Start another conversation
          </Link>
        </section>
      )}
    </div>
  );
}
