import os
import json
import time
import threading
from typing import List, Dict, Any, Optional

# Try importing Groq
try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

# Try importing Google Gemini (Modern google.genai SDK)
try:
    from google import genai
    from google.genai import types
    HAS_NEW_GENAI = True
except ImportError:
    HAS_NEW_GENAI = False

try:
    import google.generativeai as legacy_genai
    HAS_LEGACY_GENAI = True
except ImportError:
    HAS_LEGACY_GENAI = False

HAS_GEMINI = HAS_NEW_GENAI or HAS_LEGACY_GENAI

class LLMGateway:
    """
    Centralized LLM Concurrency Controller, Rate-Limit Tracker & Multi-Provider Failover Gateway.
    Protects free/metered quotas and guarantees zero downtime across Gemini and Groq.
    """
    def __init__(self, max_concurrent: int = 2):
        self.semaphore = threading.Semaphore(max_concurrent)
        self.gemini_models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]
        self.groq_models = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"]
        self.total_requests = 0
        self.total_gemini_success = 0
        self.total_groq_success = 0
        self.total_failovers = 0

    def get_api_keys(self):
        groq_key = os.environ.get("GROQ_API_KEY")
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if groq_key and ("your_groq" in groq_key or "placeholder" in groq_key):
            groq_key = None
        if gemini_key and ("your_gemini" in gemini_key or "placeholder" in gemini_key):
            gemini_key = None
        return groq_key, gemini_key

    def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.0
    ) -> Optional[Dict[str, Any]]:
        """
        Executes structured JSON generation through concurrency gate.
        Priority: Google Gemini (Detailed Reasoning) -> Instant Groq LPUs (Fast Fallback).
        """
        groq_key, gemini_key = self.get_api_keys()
        provider = os.environ.get("LLM_PROVIDER", "auto").lower().strip()

        with self.semaphore:
            self.total_requests += 1

            # 1. Primary: Google Gemini (if auto or gemini mode)
            if provider in ["gemini", "auto"] and gemini_key and HAS_GEMINI:
                res = self._call_gemini(system_prompt, user_prompt, gemini_key, temperature)
                if res is not None:
                    self.total_gemini_success += 1
                    return res
                self.total_failovers += 1
                print("[LLMGateway] Gemini unavailable or timed out; handing over to Groq LPU...")

            # 2. High-Speed Fallback: Groq LPUs
            if groq_key and HAS_GROQ:
                res = self._call_groq(system_prompt, user_prompt, groq_key, temperature)
                if res is not None:
                    self.total_groq_success += 1
                    return res
                self.total_failovers += 1
                print("[LLMGateway] Groq failed.")

            # 3. Final attempt on Gemini if provider was explicitly set to groq but failed
            if provider == "groq" and gemini_key and HAS_GEMINI:
                res = self._call_gemini(system_prompt, user_prompt, gemini_key, temperature)
                if res is not None:
                    self.total_gemini_success += 1
                    return res

            return None

    def _call_gemini(self, system_prompt: str, user_prompt: str, api_key: str, temperature: float) -> Optional[Dict[str, Any]]:
        from concurrent.futures import ThreadPoolExecutor, TimeoutError

        def _execute():
            for model_name in self.gemini_models:
                try:
                    if HAS_NEW_GENAI:
                        client = genai.Client(api_key=api_key)
                        response = client.models.generate_content(
                            model=model_name,
                            contents=user_prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                                response_mime_type="application/json",
                                temperature=temperature
                            )
                        )
                        if response.text and response.text.strip().startswith("{"):
                            return json.loads(response.text)
                    elif HAS_LEGACY_GENAI:
                        legacy_genai.configure(api_key=api_key)
                        model = legacy_genai.GenerativeModel(
                            model_name=model_name,
                            system_instruction=system_prompt,
                            generation_config={"response_mime_type": "application/json", "temperature": temperature}
                        )
                        response = model.generate_content(user_prompt)
                        if response.text and response.text.strip().startswith("{"):
                            return json.loads(response.text)
                except Exception as e:
                    print(f"[LLMGateway] Gemini model '{model_name}' attempt error: {e}")
                    continue
            return None

        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_execute)
                return future.result(timeout=12.0)
        except TimeoutError:
            print("[LLMGateway] Gemini timed out (>12s); triggering instant fast-handover to Groq...")
        except Exception as e:
            print(f"[LLMGateway] Gemini error ({e}); immediate fast-handover to Groq...")
        return None

    def _call_groq(self, system_prompt: str, user_prompt: str, api_key: str, temperature: float) -> Optional[Dict[str, Any]]:
        client = Groq(api_key=api_key, timeout=15.0)
        for model_name in self.groq_models:
            try:
                completion = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=temperature,
                    response_format={"type": "json_object"}
                )
                raw = completion.choices[0].message.content
                if raw and raw.strip().startswith("{"):
                    return json.loads(raw)
            except Exception as e:
                print(f"[LLMGateway] Groq ({model_name}) error: {e}")
                continue
        return None

    def stats(self) -> Dict[str, Any]:
        return {
            "total_requests": self.total_requests,
            "gemini_success": self.total_gemini_success,
            "groq_success": self.total_groq_success,
            "failovers": self.total_failovers
        }

# Global singleton instance
llm_gateway = LLMGateway(max_concurrent=2)
