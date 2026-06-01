"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { EnglishLevel, NativeLanguage, UserLanguageProfile } from "@/lib/db/schema";

const LEVELS: { value: EnglishLevel; label: string; detail: string }[] = [
  { value: "A1", label: "A1", detail: "First conversations" },
  { value: "A2", label: "A2", detail: "Everyday basics" },
  { value: "B1", label: "B1", detail: "Natural practice" },
  { value: "B2", label: "B2", detail: "Fluent opinions" },
  { value: "C1", label: "C1", detail: "Advanced debate" },
  { value: "C2", label: "C2", detail: "Native pace" }
];

const NATIVE_LANGUAGES: { value: NativeLanguage; label: string }[] = [
  { value: "spanish", label: "Spanish" },
  { value: "portuguese", label: "Portuguese" },
  { value: "french", label: "French" },
  { value: "italian", label: "Italian" },
  { value: "german", label: "German" },
  { value: "other", label: "Other" }
];

const TOPICS = ["travel", "music", "technology", "food", "movies", "business", "football", "gaming"];

type SetupFormProps = {
  profile: UserLanguageProfile | null;
};

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function SetupForm({ profile }: SetupFormProps) {
  const router = useRouter();
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>(profile?.englishLevel ?? "A2");
  const [nativeLanguage, setNativeLanguage] = useState<NativeLanguage>(profile?.nativeLanguage ?? "spanish");
  const [topic, setTopic] = useState(profile?.preferredTopics[0] ?? "travel");
  const [customTopic, setCustomTopic] = useState("");
  const [interests, setInterests] = useState((profile?.interests?.length ? profile.interests : ["travel", "music"]).join(", "));
  const [targetTurns, setTargetTurns] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTopic = useMemo(() => customTopic.trim() || topic, [customTopic, topic]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const parsedInterests = parseList(interests);
      const preferredTopics = Array.from(new Set([selectedTopic, ...parsedInterests])).slice(0, 5);

      const profileResponse = await fetch("/api/user-profile/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nativeLanguage,
          englishLevel,
          interests: parsedInterests.length ? parsedInterests : [selectedTopic],
          preferredTopics
        })
      });

      if (!profileResponse.ok) throw new Error("Could not save your practice profile.");

      const conversationResponse = await fetch("/api/conversation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selectedTopic, englishLevel, targetTurns })
      });

      if (!conversationResponse.ok) throw new Error("Could not start the conversation.");

      const data = (await conversationResponse.json()) as { sessionId: string };
      router.push(`/practice/${data.sessionId}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Your level</h2>
            <p className="mt-1 text-sm text-muted-foreground">Alex adapts vocabulary, speed, and questions to this level.</p>
          </div>
          <Badge className="bg-white">Step 1</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setEnglishLevel(level.value)}
              className={`rounded-lg border bg-white p-4 text-left transition-colors ${
                englishLevel === level.value ? "border-primary ring-2 ring-primary/20" : "hover:bg-muted"
              }`}
            >
              <span className="text-lg font-semibold">{level.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{level.detail}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Practice context</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick what Alex should use to make the session feel natural.</p>
          </div>
          <Badge className="bg-white">Step 2</Badge>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
          <label className="space-y-2">
            <span className="text-sm font-medium">Native language</span>
            <select
              value={nativeLanguage}
              onChange={(event) => setNativeLanguage(event.target.value as NativeLanguage)}
              className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {NATIVE_LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Interests</span>
            <Input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="travel, startups, music" />
          </label>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Today's conversation</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose a topic and session length.</p>
          </div>
          <Badge className="bg-white">Step 3</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {TOPICS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTopic(item);
                setCustomTopic("");
              }}
              className={`rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                selectedTopic === item ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-muted"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px]">
          <label className="space-y-2">
            <span className="text-sm font-medium">Custom topic</span>
            <Input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="job interviews, Argentina, product ideas" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">User turns</span>
            <Input
              type="number"
              min={4}
              max={30}
              value={targetTurns}
              onChange={(event) => setTargetTurns(Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <Button type="submit" size="lg" disabled={isSubmitting || !selectedTopic}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        Start practicing
      </Button>
    </form>
  );
}
