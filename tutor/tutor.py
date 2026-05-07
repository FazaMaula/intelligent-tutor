from anthropic import Anthropic
from dotenv import load_dotenv
from .prompts import SYSTEM_PROMPT

load_dotenv()


class IntelligentTutor:
    def __init__(self):
        self.client = Anthropic()
        self.messages = []
        self.model = "claude-opus-4-7"

    def chat(self, user_input: str) -> str:
        self.messages.append({"role": "user", "content": user_input})
        response_text = ""

        with self.client.messages.stream(
            model=self.model,
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            thinking={"type": "adaptive"},
            output_config={"effort": "high"},
            messages=self.messages,
        ) as stream:
            for text in stream.text_stream:
                print(text, end="", flush=True)
                response_text += text

        print()
        # Preserve full content block list (includes thinking blocks) for correct multi-turn state
        self.messages.append(
            {"role": "assistant", "content": stream.get_final_message().content}
        )
        return response_text

    def reset(self):
        self.messages = []
