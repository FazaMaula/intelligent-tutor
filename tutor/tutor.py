import os
from anthropic import Anthropic
from openai import OpenAI
from dotenv import load_dotenv
from .prompts import SYSTEM_PROMPT

load_dotenv()


class IntelligentTutor:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "claude")
        self.messages = []

        if self.provider == "gemini":
            self.client = OpenAI(
                api_key=os.getenv("GEMINI_API_KEY"),
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            )
            self.model = "gemini-2.5-flash"
        else:
            self.client = Anthropic()
            self.model = "claude-opus-4-7"

    def chat(self, user_input: str) -> str:
        self.messages.append({"role": "user", "content": user_input})
        if self.provider == "gemini":
            return self._chat_gemini()
        return self._chat_claude()

    def _chat_gemini(self) -> str:
        response_text = ""
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, *self.messages],
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            print(delta, end="", flush=True)
            response_text += delta
        print()
        self.messages.append({"role": "assistant", "content": response_text})
        return response_text

    def _chat_claude(self) -> str:
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
