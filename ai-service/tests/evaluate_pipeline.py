import json
import os
import sys
import time
import copy
from datetime import datetime
from collections import defaultdict

# Setup path and env BEFORE importing any ai-service modules
AI_SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, AI_SERVICE_DIR)

# Set placeholder keys so LLM gateway returns None (offline)
os.environ["GROQ_API_KEY"] = "placeholder_test_key"
os.environ["GEMINI_API_KEY"] = "placeholder_test_key"
os.environ["LLM_PROVIDER"] = "auto"

# Monkeypatch GoogleTranslator before importing main
from deep_translator import GoogleTranslator
def fake_translate(self, text=None, **kwargs):
    if text is not None:
        return text
    return ""
GoogleTranslator.translate = fake_translate

from main import process_text_pipeline

def evaluate(run_name, output_dir):
    with open("tests/synthetic/manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    results = {
        "dev": {"total": 0, "segmentation_correct": 0, "risk_exact_match": 0, "flagged": 0, "true_positives": 0, "false_positives": 0, "false_negatives": 0, "controls_flagged": 0},
        "heldout": {"total": 0, "segmentation_correct": 0, "risk_exact_match": 0, "flagged": 0, "true_positives": 0, "false_positives": 0, "false_negatives": 0, "controls_flagged": 0}
    }
    
    severity_scores = {"control": [], "mild": [], "moderate": [], "extreme": []}
    domain_results = defaultdict(lambda: {"total": 0, "risk_exact_match": 0, "segmentation_correct": 0})
    confusion_matrix = defaultdict(lambda: defaultdict(int))
    
    for item in manifest:
        doc_id = item["id"]
        split = item["split"]
        domain = item["domain"]
        severity = item["severity"]
        
        # Read text
        txt_path = os.path.join("tests", "synthetic", "docs", f"{doc_id}.txt")
        with open(txt_path, "r", encoding="utf-8") as f:
            text = f.read()
            
        # Run pipeline
        try:
            res = process_text_pipeline(text, item["language"])
        except Exception as e:
            print(f"Error processing {doc_id}: {e}")
            continue
            
        actual_clauses = res.risk_analysis if hasattr(res, "risk_analysis") else []
        expected_clauses = item["clauses"]
        
        results[split]["total"] += 1
        domain_results[domain]["total"] += 1
        
        # Segmentation check
        if len(actual_clauses) == item["expected_clause_count"]:
            results[split]["segmentation_correct"] += 1
            domain_results[domain]["segmentation_correct"] += 1
            
        doc_max_risk_score = 0
        risk_weight = {"NO_ISSUE_DETECTED": 0, "POTENTIALLY_UNENFORCEABLE": 1, "REQUIRES_REVIEW": 2, "ONE_SIDED": 3, "HIGH_RISK": 4}
            
        # Clause by clause risk exact match
        for i, expected in enumerate(expected_clauses):
            expected_risk = expected["expectedRiskLevel"]
            actual_risk = "NO_ISSUE_DETECTED"
            
            if i < len(actual_clauses):
                actual_risk = actual_clauses[i].get("riskLevel", "NO_ISSUE_DETECTED")
                
            confusion_matrix[expected_risk][actual_risk] += 1
            
            is_expected_flagged = expected_risk != "NO_ISSUE_DETECTED"
            is_actual_flagged = actual_risk != "NO_ISSUE_DETECTED"
            
            doc_max_risk_score = max(doc_max_risk_score, risk_weight.get(actual_risk, 0))
            
            if actual_risk == expected_risk:
                results[split]["risk_exact_match"] += 1
                domain_results[domain]["risk_exact_match"] += 1
                
            if is_expected_flagged and is_actual_flagged:
                results[split]["true_positives"] += 1
            elif not is_expected_flagged and is_actual_flagged:
                results[split]["false_positives"] += 1
            elif is_expected_flagged and not is_actual_flagged:
                results[split]["false_negatives"] += 1
                
        severity_scores[severity].append(doc_max_risk_score)
        if severity == "control" and doc_max_risk_score > 0:
            results[split]["controls_flagged"] += 1
            
    # Calculate PR, Recall, F1
    for split in ["dev", "heldout"]:
        tp = results[split]["true_positives"]
        fp = results[split]["false_positives"]
        fn = results[split]["false_negatives"]
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        results[split]["precision"] = precision
        results[split]["recall"] = recall
        results[split]["f1"] = f1
        
    avg_severity = {k: sum(v)/len(v) if v else 0 for k, v in severity_scores.items()}
    
    report = {
        "run_name": run_name,
        "timestamp": datetime.now().isoformat(),
        "splits": results,
        "domain_results": domain_results,
        "avg_severity": avg_severity,
        "confusion_matrix": confusion_matrix
    }
    
    # Save JSON
    timestamp = datetime.now().strftime("%Y%md%H%M%S")
    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, f"eval_{timestamp}_{run_name}.json"), "w") as f:
        json.dump(report, f, indent=2)
        
    # Write MD
    md_content = f"# Evaluation Report: {run_name}\n\n"
    md_content += f"## Dev Split\n"
    md_content += f"- Segmentation Correct: {results['dev']['segmentation_correct']}/{results['dev']['total']}\n"
    md_content += f"- Precision: {results['dev']['precision']:.2f}\n"
    md_content += f"- Recall: {results['dev']['recall']:.2f}\n"
    md_content += f"- F1: {results['dev']['f1']:.2f}\n"
    md_content += f"- False Positive Rate on Controls: {results['dev']['controls_flagged']}\n\n"
    
    md_content += f"## Heldout Split\n"
    md_content += f"- Segmentation Correct: {results['heldout']['segmentation_correct']}/{results['heldout']['total']}\n"
    md_content += f"- Precision: {results['heldout']['precision']:.2f}\n"
    md_content += f"- Recall: {results['heldout']['recall']:.2f}\n"
    md_content += f"- F1: {results['heldout']['f1']:.2f}\n"
    md_content += f"- False Positive Rate on Controls: {results['heldout']['controls_flagged']}\n\n"
    
    md_content += f"## Severity Ordering (Score 0-4)\n"
    md_content += f"Control: {avg_severity['control']:.2f} <= Mild: {avg_severity['mild']:.2f} <= Moderate: {avg_severity['moderate']:.2f} <= Extreme: {avg_severity['extreme']:.2f}\n\n"
    
    with open(os.path.join(output_dir, f"eval_{timestamp}_{run_name}.md"), "w") as f:
        f.write(md_content)
        
    print(f"Report for {run_name} written to {output_dir}/eval_{timestamp}_{run_name}.md")

if __name__ == "__main__":
    out_dir = "tests/reports"
    
    # Run 1: Legacy
    os.environ["KN_NORMALIZER_V2"] = "0"
    os.environ["CLAUSE_SEGMENTER_V2"] = "0"
    os.environ["RULE_PACKS_V2"] = "0"
    print("Running Legacy Evaluation...")
    evaluate("legacy", out_dir)
    
    # Run 2: Phase 9 only (Kannada)
    os.environ["KN_NORMALIZER_V2"] = "1"
    os.environ["CLAUSE_SEGMENTER_V2"] = "0"
    os.environ["RULE_PACKS_V2"] = "0"
    print("Running Phase 9 Evaluation...")
    evaluate("phase9", out_dir)
    
    # Run 3: All flags
    os.environ["KN_NORMALIZER_V2"] = "1"
    os.environ["CLAUSE_SEGMENTER_V2"] = "1"
    os.environ["RULE_PACKS_V2"] = "1"
    print("Running Full V2 Evaluation...")
    evaluate("full_v2", out_dir)
