import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/lib/prompts";

const provider = process.env.LLM_PROVIDER ?? "claude";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request): Promise<Response> {
  const { messages } = (await request.json()) as { messages: ChatMessage[] };
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (provider === "gemini") {
          const client = new OpenAI({
            apiKey: process.env.GEMINI_API_KEY,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
          });
          const stream = await client.chat.completions.create({
            model: "gemini-2.5-flash",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
            stream: true,
          });
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } else {
          const client = new Anthropic();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stream = client.messages.stream({
            model: "claude-opus-4-7",
            max_tokens: 1024,
            system: [
              {
                type: "text",
                text: SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" },
              },
            ],
            thinking: { type: "adaptive" },
            output_config: { effort: "high" },
            messages,
          } as any);
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        }
      } catch (err) {
        console.error("LLM error:", err);
        controller.enqueue(
          encoder.encode("\n\n[Maaf, terjadi kesalahan. Coba lagi ya!]")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
