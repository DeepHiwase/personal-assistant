import { google } from "@ai-sdk/google";
import { task } from "@trigger.dev/sdk";
import { generateText } from "ai";

export const aiTestTask = task({
  id: "ai-test",
  run: async () => {
    const { text } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      prompt: "Say hello in one short sentence.",
      maxOutputTokens: 512,
    });

    if (!text.trim()) throw new Error("AI generated an empty response");
    return { text };
  },
});
