import { fal } from "@fal-ai/client";
import type { AiProvider, ImageInput } from "@/lib/ai/types";

export const falImageProvider: AiProvider<ImageInput> = {
  type: "image",
  costCredits: 1,
  async generate(input) {
    fal.config({ credentials: process.env.FAL_KEY });

    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: { prompt: input.prompt },
      logs: false
    });

    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) throw new Error("fal.ai did not return an image URL");

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Could not download generated image: ${response.status}`);

    return {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "image/png",
      extension: "png"
    };
  }
};
