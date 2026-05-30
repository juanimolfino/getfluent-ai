"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function JobCreateForm() {
  const router = useRouter();
  const [type, setType] = useState<"image" | "tts">("image");
  const [input, setInput] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createJob(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const payload =
      type === "image"
        ? { type, input: { prompt: input } }
        : { type, input: { text: input, voice } };

    const response = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setLoading(false);
    if (response.ok) {
      setInput("");
      setMessage(`Queued job ${data.jobId}`);
      router.refresh();
      return;
    }
    setMessage(data.error ?? "Could not create job");
  }

  return (
    <form onSubmit={createJob} className="rounded-lg border bg-card p-5">
      <div className="mb-4 inline-flex rounded-md border bg-background p-1">
        <Button type="button" size="sm" variant={type === "image" ? "default" : "ghost"} onClick={() => setType("image")}>
          <ImageIcon className="h-4 w-4" />
          Image
        </Button>
        <Button type="button" size="sm" variant={type === "tts" ? "default" : "ghost"} onClick={() => setType("tts")}>
          <Mic2 className="h-4 w-4" />
          TTS
        </Button>
      </div>
      <Textarea
        required
        placeholder={type === "image" ? "Describe the image to generate..." : "Enter text to synthesize..."}
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      {type === "tts" ? (
        <select
          className="mt-3 h-10 rounded-md border bg-background px-3 text-sm"
          value={voice}
          onChange={(event) => setVoice(event.target.value)}
        >
          {["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"].map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={loading}>{loading ? "Queueing..." : "Create job"}</Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
