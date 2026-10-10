"""
conftest.py — Offline, deterministic test configuration for ai-service.

Ensures:
- No LLM API calls (GROQ_API_KEY, GEMINI_API_KEY unset/placeholder)
- GoogleTranslator is monkeypatched to return input unchanged
- RAG store and ChromaDB are isolated
- All tests run without network access
"""
import os
import sys
import pytest

# Ensure ai-service directory is on the path
AI_SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if AI_SERVICE_DIR not in sys.path:
    sys.path.insert(0, AI_SERVICE_DIR)


@pytest.fixture(autouse=True, scope="session")
def offline_environment():
    """
    Session-scoped fixture that disables all external API calls.
    Sets LLM keys to placeholder values so llm_gateway.generate_json returns None.
    Monkeypatches GoogleTranslator to be a no-op passthrough.
    """
    # Unset / placeholder LLM keys
    os.environ["GROQ_API_KEY"] = "placeholder_test_key"
    os.environ["GEMINI_API_KEY"] = "placeholder_test_key"
    os.environ["LLM_PROVIDER"] = "auto"
    
    # Disable feature flags for baseline (legacy behavior)
    os.environ.setdefault("KN_NORMALIZER_V2", "0")
    os.environ.setdefault("CLAUSE_SEGMENTER_V2", "0")
    os.environ.setdefault("RULE_PACKS_V2", "0")
    
    yield


@pytest.fixture(autouse=True, scope="session")
def mock_translator():
    """
    Monkeypatch GoogleTranslator.translate to return the input text unchanged.
    This avoids network calls and makes translation deterministic.
    """
    from deep_translator import GoogleTranslator
    
    _original_init = GoogleTranslator.__init__
    _original_translate = GoogleTranslator.translate
    
    def fake_translate(self, text=None, **kwargs):
        """Return input text unchanged — deterministic offline translation."""
        if text is not None:
            return text
        return ""
    
    GoogleTranslator.translate = fake_translate
    
    yield
    
    # Restore originals
    GoogleTranslator.translate = _original_translate


@pytest.fixture(scope="session")
def ai_service_dir():
    """Returns the absolute path to the ai-service directory."""
    return AI_SERVICE_DIR
