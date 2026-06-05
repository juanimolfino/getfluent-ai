"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { pickCreativeConversationTopic } from "@/lib/conversation/creative-topics";
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
const PROFILE_TEXT_LIMIT = 40;
const CONVERSATION_TOPIC_LIMIT = 100;

type SetupFormProps = {
  profile: UserLanguageProfile | null;
};

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => toProfileText(item))
    .filter(Boolean)
    .slice(0, 10);
}

function toProfileText(value: string) {
  return value.trim().slice(0, PROFILE_TEXT_LIMIT);
}

function toConversationTopic(value: string) {
  return value.trim().slice(0, CONVERSATION_TOPIC_LIMIT);
}

function buildPreferredTopics(selectedTopic: string, interests: string[]) {
  return Array.from(new Set([selectedTopic, ...interests].map((item) => toProfileText(item)).filter(Boolean))).slice(0, 5);
}

function displayTopic(value: string) {
  return value
    .split(/\s+/)
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SetupForm({ profile }: SetupFormProps) {
  const router = useRouter();
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>(profile?.englishLevel ?? "B2");
  const [nativeLanguage, setNativeLanguage] = useState<NativeLanguage>(profile?.nativeLanguage ?? "spanish");
  const [topic, setTopic] = useState(profile?.preferredTopics[0] ?? "gaming");
  const [customTopic, setCustomTopic] = useState("");
  const [suggestedTopic, setSuggestedTopic] = useState<string | null>(null);
  const [interests, setInterests] = useState(
    (profile?.interests?.length ? profile.interests : ["travel", "music", "fútbol", "guitar"]).join(", ")
  );
  const [targetTurns, setTargetTurns] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTopic = useMemo(() => toConversationTopic(customTopic || topic), [customTopic, topic]);
  const summaryTopic = selectedTopic ? displayTopic(selectedTopic) : "Topic";

  function suggestCreativeTopic() {
    const nextTopic = pickCreativeConversationTopic(suggestedTopic ?? selectedTopic);
    setSuggestedTopic(nextTopic);
    setTopic(nextTopic);
    setCustomTopic(nextTopic);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const parsedInterests = parseList(interests);
      const preferredTopics = buildPreferredTopics(selectedTopic, parsedInterests);

      const profileResponse = await fetch("/api/user-profile/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nativeLanguage,
          englishLevel,
          interests: parsedInterests.length ? parsedInterests : [toProfileText(selectedTopic)],
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
    <form onSubmit={handleSubmit} className="panel">
      <section className="block">
        <div className="block-head">
          <h2 className="serif">
            Your <span className="it">level</span>
          </h2>
          <span className="step">Step 1</span>
        </div>
        <p className="block-sub">Alex adapts vocabulary, speed, and questions to this level.</p>
        <div className="levels">
          {LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setEnglishLevel(level.value)}
              className={`lvl${englishLevel === level.value ? " on" : ""}`}
            >
              <div className="code">{level.label}</div>
              <div className="desc">{level.detail}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2 className="serif">
            Practice <span className="it">context</span>
          </h2>
          <span className="step">Step 2</span>
        </div>
        <p className="block-sub">What Alex should use to make the session feel like you.</p>
        <div className="two">
          <label>
            <span className="lab">Native language</span>
            <select
              value={nativeLanguage}
              onChange={(event) => setNativeLanguage(event.target.value as NativeLanguage)}
              className="ctrl"
            >
              {NATIVE_LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="lab">Interests</span>
            <input
              className="ctrl"
              value={interests}
              onChange={(event) => setInterests(event.target.value)}
              placeholder="travel, music, fútbol, guitar"
            />
          </label>
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2 className="serif">
            Today's <span className="it">conversation</span>
          </h2>
          <span className="step">Step 3</span>
        </div>
        <p className="block-sub">Pick a topic and session length - or roll a random one.</p>
        <div className="topics">
          {TOPICS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTopic(item);
                setCustomTopic("");
                setSuggestedTopic(null);
              }}
              className={`topic${!customTopic.trim() && topic === item ? " on" : ""}`}
            >
              {displayTopic(item)}
            </button>
          ))}
          <button
            type="button"
            onClick={suggestCreativeTopic}
            className={`topic random${suggestedTopic ? " on" : ""}`}
          >
            ✦ Surprise me
          </button>
        </div>
        <div className="turns-row">
          <label>
            <span className="lab">Custom topic</span>
            <input
              className="ctrl"
              value={customTopic}
              onChange={(event) => {
                setCustomTopic(event.target.value);
                setSuggestedTopic(null);
              }}
              placeholder="job interviews, Argentina, product ideas"
            />
          </label>
          <label>
            <span className="lab">User turns</span>
            <input
              className="ctrl"
              type="number"
              min={4}
              max={30}
              value={targetTurns}
              onChange={(event) => setTargetTurns(Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      {error ? <p className="setup-error">{error}</p> : null}

      <div className="start-row">
        <span className="summary">
          Ready: <b>{englishLevel}</b> · <b>{summaryTopic}</b> · <b>{targetTurns} turns</b> · voice + text
        </span>
        <button type="submit" className="btn btn-lg" disabled={isSubmitting || !selectedTopic}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Start practicing
          {!isSubmitting ? <ArrowIcon /> : null}
        </button>
      </div>
    </form>
  );
}
