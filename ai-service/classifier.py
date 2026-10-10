import json
import re
import os

_zero_shot_pipeline = None

def get_zero_shot_classifier():
    global _zero_shot_pipeline
    if _zero_shot_pipeline is None:
        try:
            from transformers import pipeline
            _zero_shot_pipeline = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
        except Exception as e:
            print(f"[Classifier] Failed to load zero-shot pipeline: {e}")
            _zero_shot_pipeline = False
    return _zero_shot_pipeline if _zero_shot_pipeline is not False else None

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
        """Tier 1: High-Confidence Header Match in the first 10-20% of the document"""
        search_limit = max(2500, int(len(text) * 0.20))
        header_text = text[:search_limit].lower()

        for domain, headers in self.taxonomy['headers'].items():
            for header in headers:
                pattern = r'(?:\b|^)' + re.escape(header.lower()) + r'(?:\b|$)'
                if re.search(pattern, header_text, re.IGNORECASE):
                    return {"domain": domain, "confidence": 1.0, "method": "Tier1_HeaderMatch"}
        return None

    def tier2_weighted_scoring(self, text: str):
        """Tier 2: Weighted Term Frequency Scoring"""
        scan_text = text[:6000].lower()
        
        scores = {domain: 0 for domain in self.taxonomy['domains']}
        
        for domain, keywords in self.taxonomy['weighted_keywords'].items():
            for keyword, weight in keywords.items():
                pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
                matches = len(re.findall(pattern, scan_text, re.IGNORECASE))
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
        classifier = get_zero_shot_classifier()
        if not classifier:
            return {"domain": "Unknown (Tie/Low Confidence)", "confidence": 0.0, "method": "Tier3_Unavailable_Missing_Transformers"}
            
        snippet = text[:2000]
        
        try:
            result = classifier(snippet, candidate_labels)
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
            
        # Tier 3: Grounded LLM Classification
        try:
            from llm_gateway import llm_gateway
            prompt = (
                f"Identify the exact legal document category for the following Indian legal text excerpt. "
                f"Candidate categories include: 'Sale Deed', 'Rental Agreement', 'Employment Contract', "
                f"'Court Pleading / Original Suit (OS)', 'Legal Notice', 'Non-Disclosure Agreement', "
                f"'Power of Attorney', 'Settlement Agreement', 'Gift Deed'.\n\n"
                f"TEXT EXCERPT:\n\"\"\"{clean_text[:2500]}\"\"\"\n\n"
                f"Respond with pure JSON adhering to: {{\"domain\": \"category name\", \"confidence\": 0.95}}"
            )
            llm_res = llm_gateway.generate_json(
                "You are an expert Indian Legal Document Classifier. Respond strictly in pure JSON.",
                prompt
            )
            if llm_res and llm_res.get("domain") and llm_res.get("domain") != "Unclassified":
                return {
                    "domain": str(llm_res.get("domain")),
                    "confidence": float(llm_res.get("confidence", 0.95)),
                    "method": "Tier3_Grounded_LLM_Classification"
                }
        except Exception as e:
            print(f"[Classifier] LLM Classification fallback error: {e}")

        # Tier 4: Zero-Shot MNLI (if transformers installed)
        t4_result = self.tier3_zero_shot(clean_text, self.taxonomy['domains'])
        if t4_result and t4_result.get("confidence", 0) > 0.4:
            return t4_result
            
        # Ultimate Fallback
        return {
            "domain": "Legal Document",
            "confidence": 0.5,
            "method": "Fallback"
        }

# Singleton instance
legal_classifier = LegalClassifier()
