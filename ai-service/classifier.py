import json
import re
import os

# Try importing transformers for Tier 3, but don't break if not installed yet
try:
    from transformers import pipeline
    zero_shot_classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False

class LegalClassifier:
    def __init__(self, taxonomy_path="taxonomy.json"):
        # Load taxonomy
        taxonomy_file = os.path.join(os.path.dirname(__file__), taxonomy_path)
        with open(taxonomy_file, 'r', encoding='utf-8') as f:
            self.taxonomy = json.load(f)

    def preprocess(self, text: str) -> str:
        # Lowercase and clean up multiple spaces/newlines
        text = text.lower()
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def tier1_header_match(self, text: str):
        """Tier 1: High-Confidence Header Match in the first 10% of the document"""
        # Get first 10% or at least first 500 characters
        search_limit = max(500, int(len(text) * 0.10))
        header_text = text[:search_limit]

        for domain, headers in self.taxonomy['headers'].items():
            for header in headers:
                if header.lower() in header_text:
                    return {"domain": domain, "confidence": 1.0, "method": "Tier1_HeaderMatch"}
        return None

    def tier2_weighted_scoring(self, text: str):
        """Tier 2: Weighted Term Frequency Scoring"""
        # Scan first ~2 pages (approx 6000 chars)
        scan_text = text[:6000]
        
        scores = {domain: 0 for domain in self.taxonomy['domains']}
        
        for domain, keywords in self.taxonomy['weighted_keywords'].items():
            for keyword, weight in keywords.items():
                # Sliding window anchor search: count occurrences of the phrase
                # Regex word boundary to avoid partial matches
                pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
                matches = len(re.findall(pattern, scan_text))
                scores[domain] += (matches * weight)

        # Find the highest scoring domain
        best_domain = max(scores, key=scores.get)
        best_score = scores[best_domain]
        
        # Sort to find the runner up
        sorted_scores = sorted(scores.values(), reverse=True)
        runner_up_score = sorted_scores[1] if len(sorted_scores) > 1 else 0

        # Confidence calculation
        total_score = sum(scores.values())
        if total_score == 0:
            return None, scores # No keywords found

        confidence = best_score / total_score
        
        # Determine if it's a tie (if runner up is very close to best score, e.g. within 3 points)
        is_tie = (best_score - runner_up_score) <= 3 and best_score > 0
        
        result = {
            "domain": best_domain, 
            "confidence": round(confidence, 2), 
            "method": "Tier2_WeightedScoring",
            "scores": scores
        }
        
        return result, is_tie

    def tier3_zero_shot(self, text: str, candidate_labels: list):
        """Tier 3: Intelligent Fallback using Zero-Shot MNLI (First 512 tokens)"""
        if not HAS_TRANSFORMERS:
            return {"domain": "Unknown (Tie/Low Confidence)", "confidence": 0.0, "method": "Tier3_Unavailable_Missing_Transformers"}
            
        # Approx 512 tokens is roughly 2000 characters
        snippet = text[:2000]
        
        try:
            result = zero_shot_classifier(snippet, candidate_labels)
            best_label = result['labels'][0]
            best_score = result['scores'][0]
            return {
                "domain": best_label,
                "confidence": round(best_score, 2),
                "method": "Tier3_ZeroShot_BART"
            }
        except Exception as e:
            print(f"Zero-shot failed: {e}")
            return None

    def classify(self, raw_text: str):
        clean_text = self.preprocess(raw_text)
        
        # Tier 1
        t1_result = self.tier1_header_match(clean_text)
        if t1_result:
            return t1_result
            
        # Tier 2
        t2_result, is_tie = self.tier2_weighted_scoring(clean_text)
        
        if t2_result and not is_tie and t2_result["scores"][t2_result["domain"]] > 5:
            # We have a clear winner from Tier 2
            # Remove raw scores before returning to frontend
            del t2_result["scores"]
            return t2_result
            
        # Tier 3 (Tie-Breaker or No clear winner)
        t3_result = self.tier3_zero_shot(clean_text, self.taxonomy['domains'])
        if t3_result:
            return t3_result
            
        # Ultimate Fallback
        return {
            "domain": "Unclassified",
            "confidence": 0.0,
            "method": "Fallback"
        }

# Singleton instance
legal_classifier = LegalClassifier()
