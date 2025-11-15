# context-iq/backend/core/llm_service.py
import torch
from transformers import T5ForConditionalGeneration, T5Tokenizer, AutoTokenizer, AutoModelForCausalLM
from typing import List, Dict, Any, Optional
import os
from functools import lru_cache
import traceback

# --- FIX: Changed 'ml.extractor' to 'ml.extractor' (it was already correct) ---
# --- and 'core.audit_service' to relative '.audit_service' ---
from ml.extractor import ExtractorService
from .audit_service import log_action, AuditCategory, AuditLevel
# --- End of fixes ---


class LLMService:
    """
    Advanced LLM service for answer generation and summarization.
    UPDATED: Added generate_summary method.
    """
    _instance = None
    _model = None
    _tokenizer = None
    _device = None
    _model_type = None

    AVAILABLE_MODELS = {
        "flan-t5-base": "google/flan-t5-base",
        "flan-t5-large": "google/flan-t5-large",
        "gpt2": "gpt2",
        "gpt2-medium": "gpt2-medium",
        "phi-2": "microsoft/phi-2",
    }

    DEFAULT_MODEL = os.getenv("LLM_MODEL", "flan-t5-base")

    def __new__(cls):
        if cls._instance is None:
            print("Initializing LLMService...")
            cls._instance = super(LLMService, cls).__new__(cls)
            cls._instance._initialize_model()
        return cls._instance

    def _initialize_model(self):
        """Initialize the LLM model with device detection and error handling."""
        try:
            self._device = self._get_best_device()
            print(f"   → Using device: {self._device}")

            model_key = self.DEFAULT_MODEL.lower()
            if model_key not in self.AVAILABLE_MODELS:
                print(f"   Warning: Unknown model '{model_key}', falling back to flan-t5-base")
                model_key = "flan-t5-base"

            model_name = self.AVAILABLE_MODELS[model_key]
            print(f"   → Loading model: {model_name}")

            self._model_type = self._detect_model_type(model_key)

            if self._model_type == "t5":
                self._load_t5_model(model_name)
            elif self._model_type == "gpt":
                self._load_gpt_model(model_name)
            else:
                raise ValueError(f"Unsupported model type: {self._model_type}")

            if self._model:
                self._model.to(self._device)
                self._model.eval()
                print(f"   Model loaded successfully on {self._device}")

        except Exception as e:
            print(f"   Error loading LLM model: {e}")
            traceback.print_exc()
            print("   Continuing with fallback mode (no generative capabilities)")
            self._model = None
            self._tokenizer = None

    def _get_best_device(self) -> str:
        """Detect the best available device (CUDA > MPS > CPU)."""
        if torch.cuda.is_available():
            return "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        else:
            return "cpu"

    def _detect_model_type(self, model_key: str) -> str:
        """Detect model architecture type."""
        if "t5" in model_key or "flan" in model_key:
            return "t5"
        elif "gpt" in model_key or "phi" in model_key:
            return "gpt"
        else:
            return "t5"

    def _load_t5_model(self, model_name: str):
        """Load T5-based models (FLAN-T5, etc.)."""
        self._tokenizer = T5Tokenizer.from_pretrained(model_name)
        self._model = T5ForConditionalGeneration.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if self._device == "cuda" else torch.float32
        )

    def _load_gpt_model(self, model_name: str):
        """Load GPT-based models."""
        self._tokenizer = AutoTokenizer.from_pretrained(model_name)
        self._model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if self._device == "cuda" else torch.float32
        )
        if self._tokenizer.pad_token is None:
            self._tokenizer.pad_token = self._tokenizer.eos_token

    @lru_cache(maxsize=100)
    def _cached_generation(self, prompt_hash: str, prompt: str) -> str:
        """Cached generation to avoid recomputing identical queries."""
        return self._generate_raw(prompt)

    def generate_answer(
        self,
        query: str,
        context: List[Dict[str, Any]],
        chat_history: Optional[List[Dict[str, str]]] = None,
        include_sources: bool = True,
        max_context_items: int = 5
    ) -> str:
        """
        Generates a natural language answer based on the query, context, and chat history.
        """
        if not self._model or not self._tokenizer:
            return self._generate_fallback_answer(query, context)

        if not context and not chat_history:
            return "I couldn't find any relevant information in the context to answer your query. Please try rephrasing or asking about a different topic."

        # Limit context to prevent token overflow
        context = context[:max_context_items]

        # Build enhanced prompt
        prompt = self._build_prompt(query, context, chat_history or [])

        try:
            prompt_hash = str(hash(prompt))
            answer = self._cached_generation(prompt_hash, prompt)

            # Add source attribution if requested
            if include_sources and answer and context:
                sources = self._format_sources(context)
                answer = f"{answer}\n\n**Sources:**\n{sources}"

            return answer

        except Exception as e:
            print(f"Error during LLM generation: {e}")
            traceback.print_exc()
            return self._generate_fallback_answer(query, context, str(e))

    def _build_prompt(
        self,
        query: str,
        context: List[Dict[str, Any]],
        chat_history: List[Dict[str, str]]
    ) -> str:
        """Build an optimized prompt with context and chat history."""

        # Build Chat History String
        history_str = ""
        if chat_history:
            history_parts = []
            for msg in chat_history:
                role = "User" if msg.get("role") == "user" else "AI"
                history_parts.append(f"{role}: {msg.get('content')}")
            history_str = "\n".join(history_parts)

        # Build context string with metadata
        context_parts = []
        if context:
            sentiment_summary = self._summarize_sentiments([item.get('sentiment_label', 'neutral') for item in context])
            context_header = f"Context ({len(context)} items, {sentiment_summary}):"
            context_parts.append(context_header)

            for i, item in enumerate(context, 1):
                source = item.get('source', 'unknown').upper()
                user = item.get('user_name', 'unknown')
                text = item.get('text', '')
                context_parts.append(
                    f"[{i}] Source: {source} | User: {user}\n"
                    f'"{text}"'
                )

        context_str = "\n\n".join(context_parts)

        # Construct prompt with history
        if self._model_type == "t5":
            prompt = f"""You are a helpful AI assistant. Answer the user's question based on the provided context and conversation history.
Do not use external knowledge.

Instructions:
- Provide a clear, concise answer.
- Prioritize new context to answer the question.
- Reference specific sources [1], [2], etc.
- If the context doesn't contain enough information, say so.

--- BEGIN CONVERSATION HISTORY ---
{history_str}
--- END CONVERSATION HISTORY ---

--- BEGIN PROVIDED CONTEXT ---
{context_str}
--- END PROVIDED CONTEXT ---

User: {query}
AI Answer:"""

        else:  # GPT-style
            prompt = f"""You are a helpful AI assistant.
Answer the user's question based on the conversation history and the provided context below.

CONVERSATION HISTORY:
{history_str}

PROVIDED CONTEXT:
{context_str}

User: {query}
Answer:"""

        return prompt

    # --- NEW: Summarization Method ---
    def generate_summary(
        self,
        conversation_history: List[Dict[str, str]],
        topic: str,
        summary_type: str = "auto"
    ) -> str:
        """
        Generates a summary of a long conversation.

        Args:
            conversation_history: List of {"user_name": "...", "text": "..."} dicts
            topic: The topic/channel of the conversation
            summary_type: "auto", "bullet_points", "narrative"

        Returns:
            Generated summary string
        """
        if not self._model or not self._tokenizer:
            return "Error: Summarization model not loaded."

        if not conversation_history:
            return "No conversation history was provided to summarize."

        # Format the conversation for the prompt
        transcript = "\n".join(
            f"{msg['user_name']}: {msg['text']}"
            for msg in conversation_history
        )

        # Truncate very long transcripts to fit context window (~2500 tokens)
        if len(transcript) > 10000:
            transcript = transcript[:10000] + "\n... [TRUNCATED]"

        # Build a dedicated prompt for summarization
        if self._model_type == "t5":
            if summary_type == "bullet_points":
                prompt_instruction = "Provide a concise summary of the key points, decisions, and action items in bullet points."
            elif summary_type == "narrative":
                prompt_instruction = "Write a short narrative summary (2-3 sentences) capturing the main discussion, decisions, and sentiment."
            else:  # auto
                prompt_instruction = "Summarize the key decisions, assigned tasks, open questions, and overall sentiment. Use bullet points if many items, otherwise a short paragraph."

            prompt = f"""Summarize the following conversation from the '{topic}' context.
{prompt_instruction}

--- BEGIN CONVERSATION ---
{transcript}
--- END CONVERSATION ---

Summary:"""

        else:  # GPT-style
            style = ""
            if summary_type == "bullet_points":
                style = "Use bullet points for key decisions, tasks, and sentiment."
            elif summary_type == "narrative":
                style = "Write a concise 2-3 sentence narrative."

            prompt = f"""You are an AI assistant. Summarize the key decisions, tasks, and sentiment from the following conversation transcript from '{topic}'.
{style}

TRANSCRIPT:
{transcript}

SUMMARY:"""

        try:
            # Use a different hash for caching summaries
            prompt_hash = f"summary_{str(hash(prompt))}"
            summary = self._cached_generation(prompt_hash, prompt)
            return summary.strip()

        except Exception as e:
            print(f"Error during LLM summarization: {e}")
            traceback.print_exc()
            return f"Error generating summary: {e}"

    def predict(self, prompt: str) -> str:
        """
        Simple prediction method for general text generation.
        Used by risk analysis and other features.
        """
        if not self._model or not self._tokenizer:
            return "Error: Model not loaded."
        
        try:
            return self._generate_raw(prompt)
        except Exception as e:
            print(f"Error during prediction: {e}")
            traceback.print_exc()
            return f"Error: {str(e)}"

    def _summarize_sentiments(self, sentiments: List[str]) -> str:
        """Create a brief sentiment summary."""
        if not sentiments:
            return "neutral tone"

        counts = {}
        for s in sentiments:
            counts[s] = counts.get(s, 0) + 1

        total = len(sentiments)
        parts = [f"{count}/{total} {label}" for label, count in counts.items()]
        return ", ".join(parts)

    def _generate_raw(self, prompt: str) -> str:
        """Raw generation without caching."""
        if self._model_type == "t5":
            return self._generate_t5(prompt)
        else:
            return self._generate_gpt(prompt)

    def _generate_t5(self, prompt: str) -> str:
        """Generate using T5-based models."""
        inputs = self._tokenizer(
            prompt,
            return_tensors="pt",
            max_length=1024,
            truncation=True,
            padding=True
        ).to(self._device)

        with torch.no_grad():
            outputs = self._model.generate(
                **inputs,
                max_length=512,
                min_length=50,
                num_beams=4,
                length_penalty=1.0,
                early_stopping=True,
                no_repeat_ngram_size=3,
                temperature=0.7
            )

        return self._tokenizer.decode(outputs[0], skip_special_tokens=True).strip()

    def _generate_gpt(self, prompt: str) -> str:
        """Generate using GPT-based models."""
        inputs = self._tokenizer(
            prompt,
            return_tensors="pt",
            max_length=1024,
            truncation=True,
            padding=True
        ).to(self._device)

        with torch.no_grad():
            outputs = self._model.generate(
                **inputs,
                max_new_tokens=512,
                min_length=50,
                num_beams=4,
                length_penalty=1.0,
                early_stopping=True,
                no_repeat_ngram_size=3,
                temperature=0.7,
                do_sample=False,
                pad_token_id=self._tokenizer.pad_token_id
            )

        prompt_length = inputs['input_ids'].shape[1]
        return self._tokenizer.decode(outputs[0][prompt_length:], skip_special_tokens=True).strip()

    def _format_sources(self, context: List[Dict[str, Any]]) -> str:
        """Format source attribution."""
        sources = []
        for i, item in enumerate(context, 1):
            source = item.get('source', 'N/A').upper()
            user = item.get('user_name', 'N/A')
            sources.append(f"[{i}] {source} - {user}")
        return "\n".join(sources)

    def _generate_fallback_answer(
        self,
        query: str,
        context: List[Dict[str, Any]],
        error: str = ""
    ) -> str:
        """Fallback response when LLM is unavailable."""
        if not context:
            return "I couldn't find any relevant information to answer your query."

        parts = [
            f"**Query:** {query}\n",
            f"**Found {len(context)} relevant items** (LLM unavailable{f': {error}' if error else ''}):\n"
        ]

        for i, item in enumerate(context[:3], 1):
            snippet = item.get('text', '')
            snippet = snippet if len(snippet) <= 200 else snippet[:197] + "..."
            parts.append(
                f"\n**[{i}]** {item.get('source', 'N/A').upper()} - {item.get('user_name', 'N/A')} ({item.get('sentiment_label', 'N/A')}):\n"
                f'"{snippet}"'
            )

        if len(context) > 3:
            parts.append(f"\n... and {len(context) - 3} more results.")

        return "\n".join(parts)

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model."""
        return {
            "model_loaded": self._model is not None,
            "model_type": self._model_type,
            "device": self._device,
            "model_name": self.DEFAULT_MODEL,
            "available_models": list(self.AVAILABLE_MODELS.keys())
        }

    def clear_cache(self):
        """Clear the generation cache."""
        self._cached_generation.cache_clear()
        print("LLM cache cleared")


def get_llm() -> LLMService:
    """
    Singleton getter for the LLMService.
    """
    return llm_service


def get_embedding_model():
    """
    Singleton getter for the EmbeddingService.
    """
    # We're importing here to avoid circular dependencies
    # and ensure the embedding_service is already initialized.
    from .embedding import embedding_service
    return embedding_service


# Singleton instance
llm_service = LLMService()


def get_llm_service() -> LLMService:
    """Get the singleton LLM service instance."""
    return llm_service