import os
import hashlib
import json
import time
from typing import Optional, Dict, Any

PROMPT_VERSION = "v2.1_grounded"

class ContextAwareCache:
    """
    Safe Context-Aware In-Memory & Redis Cache for Clause Legal Findings.
    Keying is multi-factorial to prevent cross-contextual collision while eliminating
    redundant LLM calls across documents and repeated runs.
    """
    def __init__(self, maxsize: int = 2000, ttl_seconds: int = 86400):
        self.maxsize = maxsize
        self.ttl_seconds = ttl_seconds
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._hit_count = 0
        self._miss_count = 0

    def generate_cache_key(
        self,
        clause_text: str,
        clause_type: str = "General Clause",
        domain: Optional[str] = None,
        state: Optional[str] = None,
        country: str = "India",
        context_hash: Optional[str] = None,
        authority_hash: Optional[str] = None
    ) -> str:
        """
        Generates SHA-256 cache key based on text, context, type, domain, jurisdiction and prompt version.
        """
        norm_text = " ".join(clause_text.strip().lower().split())
        raw_key_material = f"{norm_text}|{clause_type.strip().lower()}|{str(domain).lower()}|{str(state).lower()}|{country.lower()}|{context_hash or ''}|{authority_hash or ''}|{PROMPT_VERSION}"
        return hashlib.sha256(raw_key_material.encode("utf-8")).hexdigest()

    def get(
        self,
        clause_text: str,
        clause_type: str = "General Clause",
        domain: Optional[str] = None,
        state: Optional[str] = None,
        country: str = "India",
        context_hash: Optional[str] = None,
        authority_hash: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        key = self.generate_cache_key(clause_text, clause_type, domain, state, country, context_hash, authority_hash)
        entry = self._memory_cache.get(key)
        if entry:
            # Check TTL
            if time.time() - entry["timestamp"] < self.ttl_seconds:
                self._hit_count += 1
                return entry["data"]
            else:
                del self._memory_cache[key]
        self._miss_count += 1
        return None

    def set(
        self,
        clause_text: str,
        finding: Dict[str, Any],
        clause_type: str = "General Clause",
        domain: Optional[str] = None,
        state: Optional[str] = None,
        country: str = "India",
        context_hash: Optional[str] = None,
        authority_hash: Optional[str] = None
    ):
        key = self.generate_cache_key(clause_text, clause_type, domain, state, country, context_hash, authority_hash)
        if len(self._memory_cache) >= self.maxsize:
            # Evict oldest entry (simple FIFO/LRU eviction)
            oldest_key = next(iter(self._memory_cache))
            del self._memory_cache[oldest_key]
        self._memory_cache[key] = {
            "timestamp": time.time(),
            "data": finding
        }

    def stats(self) -> Dict[str, Any]:
        return {
            "size": len(self._memory_cache),
            "hits": self._hit_count,
            "misses": self._miss_count,
            "hit_ratio": (self._hit_count / (self._hit_count + self._miss_count)) if (self._hit_count + self._miss_count) > 0 else 0.0
        }

# Global singleton instance
clause_cache = ContextAwareCache()
