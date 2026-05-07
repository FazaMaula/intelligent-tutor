import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/prompts";

const client = new Anthropic();

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
      } catch (err) {
        console.error("Claude API error:", err);
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
