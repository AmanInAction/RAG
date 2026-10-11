import os
from typing import Any

from dotenv import load_dotenv

from .config import GEMINI_MODEL_NAME, GROQ_MODEL_NAME


class LLMProvider:
    """Generate text with a configured Gemini or Groq chat model."""

    def __init__(
        self,
        provider: str | None = None,
        model_name: str | None = None,
    ) -> None:
        load_dotenv()
        self.provider = (provider or os.getenv("LLM_PROVIDER", "gemini")).lower()
        self.model_name = model_name or (
            os.getenv("GROQ_MODEL_NAME", GROQ_MODEL_NAME)
            if self.provider == "groq"
            else os.getenv("GEMINI_MODEL_NAME", GEMINI_MODEL_NAME)
        )
        if self.provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise RuntimeError(
                    "GEMINI_API_KEY is required when LLM_PROVIDER=gemini."
                )
            from google import genai

            self.client: Any = genai.Client(api_key=api_key)
        elif self.provider == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise RuntimeError("GROQ_API_KEY is required when LLM_PROVIDER=groq.")
            from langchain_groq import ChatGroq

            self.client = ChatGroq(api_key=api_key, model=self.model_name)
        else:
            raise ValueError(
                f"Unsupported LLM provider {self.provider!r}; use 'gemini' or 'groq'."
            )

    def generate(self, prompt: str) -> str:
        if self.provider == "gemini":
            response = self.client.interactions.create(
                model=self.model_name,
                input=prompt,
            )
            return response.output_text

        response = self.client.invoke(prompt)
        content = response.content
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text_parts = [
                part["text"]
                for part in content
                if isinstance(part, dict) and isinstance(part.get("text"), str)
            ]
            if text_parts:
                return "".join(text_parts)
        raise TypeError("Groq returned a response without text content.")
