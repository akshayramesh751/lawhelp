import json
import os
import random
import fitz  # PyMuPDF

DOMAINS = ["employment", "rental", "nda", "vendor_msa", "criminal_bond"]
SEVERITIES = ["control", "mild", "moderate", "extreme"]
LANGUAGES = ["en", "kan"]
SPLITS = ["dev", "heldout"]

# Numbering styles to test segmentation
NUMBERING_STYLES = [
    "1. {title}\n{body}",
    "1) {title}\n{body}",
    "Clause {n}. {title}\n{body}",
    "ARTICLE {n} - {title}\n{body}",
    "Section {n}\n{title}: {body}",
    "{title}\n{body}",  # Unnumbered heading
]

CLAUSE_BANKS = {
    "employment": {
        "headers": ["Engagement & Duties", "Remuneration", "Confidentiality", "Termination & Notice", "Governing Law"],
        "control": [
            ("Engagement & Duties", "The Employee is appointed as Software Engineer and shall perform backend development tasks.", "NO_ISSUE_DETECTED"),
            ("Remuneration", "The Employer shall pay a monthly gross salary of Rs. 1,00,000/-, payable on the 1st of each month.", "NO_ISSUE_DETECTED"),
            ("Confidentiality", "The Employee agrees to keep company trade secrets secure during the tenure of employment.", "NO_ISSUE_DETECTED"),
            ("Termination & Notice", "Either party may terminate this agreement by providing 30 days prior written notice.", "NO_ISSUE_DETECTED"),
            ("Governing Law", "This agreement shall be governed by the laws of India and courts at Bengaluru shall have jurisdiction.", "NO_ISSUE_DETECTED"),
        ],
        "mild": [
            ("Termination & Notice", "The Employer may terminate this agreement with 15 days notice, while the Employee must provide 30 days notice.", "ONE_SIDED"),
        ],
        "moderate": [
            ("Termination & Notice", "The Employer reserves the right to terminate the Employee immediately without any prior notice. The Employee must provide 60 days notice.", "ONE_SIDED"),
        ],
        "extreme": [
            ("Termination & Notice", "The Employer may terminate this agreement immediately at its sole discretion without notice or compensation. The Employee must provide 90 days notice and forfeit all accrued benefits.", "HIGH_RISK"),
        ],
    },
    "rental": {
        "headers": ["Demised Premises", "Monthly Rent", "Security Deposit", "Lease Tenure", "Notice Period", "Governing Law"],
        "control": [
            ("Demised Premises", "The premises located at Flat No. 101, Residency Road, Bengaluru.", "NO_ISSUE_DETECTED"),
            ("Monthly Rent", "The Lessee shall pay a monthly rent of Rs. 25,000/- on or before the 5th.", "NO_ISSUE_DETECTED"),
            ("Security Deposit", "The Lessee has deposited a refundable security deposit of Rs. 1,50,000/-.", "NO_ISSUE_DETECTED"),
            ("Lease Tenure", "The lease is for 11 months with no lock-in period.", "NO_ISSUE_DETECTED"),
            ("Notice Period", "Either party may terminate the tenancy by providing 1 month written notice.", "NO_ISSUE_DETECTED"),
            ("Governing Law", "Governed by the Transfer of Property Act 1882.", "NO_ISSUE_DETECTED"),
        ],
        "mild": [
            ("Security Deposit", "The landlord may deduct standard painting charges from the deposit.", "NO_ISSUE_DETECTED"),
            ("Notice Period", "The tenant must provide 2 months notice, but the landlord may terminate with 1 month notice.", "ONE_SIDED"),
        ],
        "moderate": [
            ("Security Deposit", "The landlord shall forfeit the entire deposit if the tenant vacates early.", "HIGH_RISK"),
        ],
        "extreme": [
            ("Notice Period", "The landlord may evict the tenant immediately without notice. The tenant shall have no right to dispute this.", "HIGH_RISK"),
            ("Monthly Rent", "The landlord can increase the rent at their sole discretion at any time.", "ONE_SIDED"),
        ]
    },
    "nda": {
        "headers": ["Confidential Information", "Obligations", "Term", "Remedies", "Governing Law"],
        "control": [
            ("Confidential Information", "Includes all non-public information disclosed by either party.", "NO_ISSUE_DETECTED"),
            ("Obligations", "Both parties agree to use reasonable care to protect confidential information.", "NO_ISSUE_DETECTED"),
            ("Term", "Confidentiality survives for 3 years after the termination of this agreement.", "NO_ISSUE_DETECTED"),
            ("Remedies", "Parties may seek injunctive relief for breach.", "NO_ISSUE_DETECTED"),
            ("Governing Law", "Governed by the laws of India.", "NO_ISSUE_DETECTED"),
        ],
        "mild": [
            ("Obligations", "The Receiving Party must protect information with the highest degree of care.", "ONE_SIDED"),
        ],
        "moderate": [
            ("Term", "Confidentiality obligations will survive forever.", "REQUIRES_REVIEW"),
        ],
        "extreme": [
            ("Obligations", "Only the Disclosing Party's info is solely confidential.", "ONE_SIDED"),
        ]
    },
    "vendor_msa": {
        "headers": ["Services", "Payment Terms", "Liability", "Termination", "Governing Law"],
        "control": [
            ("Services", "Vendor shall provide IT support services as defined in Annexure A.", "NO_ISSUE_DETECTED"),
            ("Payment Terms", "Payment shall be made within 30 days of invoice.", "NO_ISSUE_DETECTED"),
            ("Liability", "Liability of both parties is limited to the total contract value.", "NO_ISSUE_DETECTED"),
            ("Termination", "Either party may terminate for convenience with 30 days notice.", "NO_ISSUE_DETECTED"),
            ("Governing Law", "Governed by the laws of India.", "NO_ISSUE_DETECTED"),
        ],
        "mild": [
            ("Payment Terms", "Payment shall be made within 90 days of invoice.", "ONE_SIDED"),
        ],
        "moderate": [
            ("Liability", "The vendor liability shall not be limited.", "HIGH_RISK"),
        ],
        "extreme": [
            ("Liability", "The vendor liability shall not be limited. The client bears zero liability under any circumstances.", "HIGH_RISK"),
            ("Termination", "Client may terminate immediately without notice. Vendor has no right to terminate.", "ONE_SIDED"),
        ]
    },
    "criminal_bond": {
        "headers": ["Purpose", "Obligations of Surety", "Forfeiture", "Jurisdiction", "Signatures"],
        "control": [
            ("Purpose", "This bond is executed for the release of the accused on bail.", "NO_ISSUE_DETECTED"),
            ("Obligations of Surety", "The surety undertakes to produce the accused before the court as required.", "NO_ISSUE_DETECTED"),
            ("Forfeiture", "If the accused fails to appear, the bond amount of Rs. 50,000/- may be forfeited.", "NO_ISSUE_DETECTED"),
            ("Jurisdiction", "Subject to the jurisdiction of the competent court.", "NO_ISSUE_DETECTED"),
            ("Signatures", "Signed and delivered by the surety.", "NO_ISSUE_DETECTED"),
        ],
        "mild": [
            ("Obligations of Surety", "The surety must physically accompany the accused to the police station every day.", "REQUIRES_REVIEW"),
        ],
        "moderate": [
            ("Jurisdiction", "The parties waive the right to approach any court.", "POTENTIALLY_UNENFORCEABLE"),
        ],
        "extreme": [
            ("Forfeiture", "The surety is personally liable for all future acts of the accused and waives all rights to a hearing.", "POTENTIALLY_UNENFORCEABLE"),
        ]
    }
}

KANNADA_TEMPLATES = {
    "rental": {
        "headers": ["ಬಾಡಿಗೆ ಕರಾರು", "ತಿಂಗಳ ಬಾಡಿಗೆ", "ಮುಂಗಡ ಠೇವಣಿ", "ಅವಧಿ", "ಸೂಚನೆ", "ನ್ಯಾಯವ್ಯಾಪ್ತಿ"],
        "control": [
            ("ಬಾಡಿಗೆ ಕರಾರು", "ಬೆಂಗಳೂರಿನಲ್ಲಿರುವ ಮನೆಯ ಬಾಡಿಗೆ ಒಪ್ಪಂದ.", "NO_ISSUE_DETECTED"),
            ("ತಿಂಗಳ ಬಾಡಿಗೆ", "ಬಾಡಿಗೆದಾರರು ಪ್ರತಿ ತಿಂಗಳು ರೂ 20,000 ಬಾಡಿಗೆ ನೀಡಬೇಕು.", "NO_ISSUE_DETECTED"),
            ("ಮುಂಗಡ ಠೇವಣಿ", "ಬಾಡಿಗೆದಾರರು ರೂ 1,00,000 ಮುಂಗಡ ಹಣ ನೀಡಿದ್ದಾರೆ.", "NO_ISSUE_DETECTED"),
            ("ಅವಧಿ", "ಈ ಒಪ್ಪಂದವು 11 ತಿಂಗಳ ಅವಧಿಗೆ ಇರುತ್ತದೆ.", "NO_ISSUE_DETECTED"),
            ("ಸೂಚನೆ", "ಯಾವುದೇ ಪಕ್ಷವು 1 ತಿಂಗಳ ಮುನ್ಸೂಚನೆ ನೀಡಿ ಒಪ್ಪಂದ ರದ್ದು ಮಾಡಬಹುದು.", "NO_ISSUE_DETECTED"),
            ("ನ್ಯಾಯವ್ಯಾಪ್ತಿ", "ಇದು ಬೆಂಗಳೂರು ನ್ಯಾಯಾಲಯದ ವ್ಯಾಪ್ತಿಗೆ ಒಳಪಡುತ್ತದೆ.", "NO_ISSUE_DETECTED"),
        ],
        "mild": [
            ("ಸೂಚನೆ", "ಮಾಲೀಕರು 1 ತಿಂಗಳ ಮುನ್ಸೂಚನೆ ನೀಡಬಹುದು, ಆದರೆ ಬಾಡಿಗೆದಾರರು 2 ತಿಂಗಳ ಮುನ್ಸೂಚನೆ ನೀಡಬೇಕು.", "ONE_SIDED"),
        ],
        "moderate": [
            ("ಮುಂಗಡ ಠೇವಣಿ", "ಬಾಡಿಗೆದಾರರು ಅವಧಿಗೆ ಮುನ್ನ ಮನೆ ಖಾಲಿ ಮಾಡಿದರೆ, ಸಂಪೂರ್ಣ ಠೇವಣಿ ಮುಟ್ಟುಗೋಲು ಹಾಕಿಕೊಳ್ಳಲಾಗುವುದು.", "HIGH_RISK"),
        ],
        "extreme": [
            ("ಸೂಚನೆ", "ಮಾಲೀಕರು ಯಾವುದೇ ಮುನ್ಸೂಚನೆ ಇಲ್ಲದೆ ತಕ್ಷಣವೇ ಒಪ್ಪಂದ ರದ್ದು ಮಾಡಬಹುದು. ಬಾಡಿಗೆದಾರರಿಗೆ ಯಾವುದೇ ಹಕ್ಕಿಲ್ಲ.", "HIGH_RISK"),
        ]
    },
    "employment": {
        "headers": ["ಉದ್ಯೋಗ ಒಪ್ಪಂದ", "ವೇತನ", "ಗೌಪ್ಯತೆ", "ರದ್ದತಿ", "ನ್ಯಾಯವ್ಯಾಪ್ತಿ"],
        "control": [
            ("ಉದ್ಯೋಗ ಒಪ್ಪಂದ", "ಉದ್ಯೋಗಿಯನ್ನು ತಂತ್ರಾಂಶ ಇಂಜಿನಿಯರ್ ಆಗಿ ನೇಮಿಸಲಾಗಿದೆ.", "NO_ISSUE_DETECTED"),
            ("ವೇತನ", "ಮಾಸಿಕ ವೇತನ ರೂ 50,000 ನಿಗದಿಪಡಿಸಲಾಗಿದೆ.", "NO_ISSUE_DETECTED"),
            ("ಗೌಪ್ಯತೆ", "ಕಂಪನಿಯ ಗೌಪ್ಯ ಮಾಹಿತಿಯನ್ನು ರಕ್ಷಿಸಲು ಉದ್ಯೋಗಿ ಒಪ್ಪಿದ್ದಾರೆ.", "NO_ISSUE_DETECTED"),
            ("ರದ್ದತಿ", "ಯಾವುದೇ ಪಕ್ಷವು 30 ದಿನಗಳ ಮುನ್ಸೂಚನೆ ನೀಡಿ ರದ್ದು ಮಾಡಬಹುದು.", "NO_ISSUE_DETECTED"),
            ("ನ್ಯಾಯವ್ಯಾಪ್ತಿ", "ಇದು ಬೆಂಗಳೂರು ನ್ಯಾಯಾಲಯದ ವ್ಯಾಪ್ತಿಗೆ ಒಳಪಡುತ್ತದೆ.", "NO_ISSUE_DETECTED"),
        ],
        "mild": [
            ("ರದ್ದತಿ", "ಕಂಪನಿಯು 15 ದಿನಗಳ ಮುನ್ಸೂಚನೆ ನೀಡಬಹುದು, ಉದ್ಯೋಗಿ 30 ದಿನಗಳ ಮುನ್ಸೂಚನೆ ನೀಡಬೇಕು.", "ONE_SIDED"),
        ],
        "moderate": [
            ("ರದ್ದತಿ", "ಕಂಪನಿಯು ಯಾವುದೇ ಮುನ್ಸೂಚನೆ ಇಲ್ಲದೆ ಉದ್ಯೋಗಿಯನ್ನು ವಜಾಗೊಳಿಸಬಹುದು.", "ONE_SIDED"),
        ],
        "extreme": [
            ("ರದ್ದತಿ", "ಕಂಪನಿಯು ಸ್ವಂತ ವಿವೇಚನೆಯಿಂದ ಉದ್ಯೋಗಿಯನ್ನು ವಜಾಗೊಳಿಸಬಹುದು ಮತ್ತು ಉದ್ಯೋಗಿ ಯಾವುದೇ ಪರಿಹಾರ ಕೇಳುವಂತಿಲ್ಲ.", "HIGH_RISK"),
        ]
    }
}

def generate_pdf(text, path):
    doc = fitz.open()
    page = doc.new_page()
    rect = fitz.Rect(50, 50, 550, 800)
    page.insert_textbox(rect, text, fontsize=11, fontname="helv")
    doc.save(path)
    doc.close()

def build_document(domain_bank, domain, lang, severity, num_style, doc_index):
    clauses = []
    expected_risks = []
    
    headers = domain_bank["headers"]
    control_clauses = domain_bank["control"]
    
    for i, (hdr, body, risk) in enumerate(control_clauses):
        actual_risk = risk
        actual_body = body
        
        # Inject severity clauses if available for this header
        if severity != "control" and severity in domain_bank:
            for s_hdr, s_body, s_risk in domain_bank[severity]:
                if s_hdr == hdr:
                    actual_body = s_body
                    actual_risk = s_risk
                    break
        
        # In a generic "unnumbered" style, we just use the header
        if "{n}" not in num_style:
            clause_text = num_style.format(title=hdr.upper() if i % 2 == 0 else hdr, body=actual_body)
        else:
            clause_text = num_style.format(n=i+1, title=hdr, body=actual_body)
            
        clauses.append(clause_text)
        expected_risks.append({
            "clauseIndex": i + 1,
            "expectedRiskLevel": actual_risk
        })
        
    doc_text = f"DOCUMENT ID: {doc_index}\nDOMAIN: {domain.upper()}\n\n" + "\n\n".join(clauses)
    return doc_text, expected_risks

def main():
    random.seed(42)
    docs_dir = "docs"
    os.makedirs(docs_dir, exist_ok=True)
    
    manifest = []
    doc_index = 1
    
    # Generate English docs
    for domain in DOMAINS:
        for severity in SEVERITIES:
            num_style = random.choice(NUMBERING_STYLES)
            split = "dev" if random.random() < 0.7 else "heldout"
            
            text, expected_clauses = build_document(CLAUSE_BANKS[domain], domain, "en", severity, num_style, doc_index)
            
            doc_id = f"doc_{doc_index:03d}_{domain}_{severity}_en"
            txt_path = os.path.join(docs_dir, f"{doc_id}.txt")
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(text)
                
            # Create PDF for every 3rd doc to test PyMuPDF extraction
            if doc_index % 3 == 0:
                pdf_path = os.path.join(docs_dir, f"{doc_id}.pdf")
                generate_pdf(text, pdf_path)
            
            manifest.append({
                "id": doc_id,
                "domain": domain,
                "language": "en",
                "severity": severity,
                "numbering_style": num_style,
                "split": split,
                "expected_clause_count": len(expected_clauses),
                "clauses": expected_clauses,
                "needs_lawyer_review": True
            })
            doc_index += 1
            
    # Generate Kannada docs
    for domain in KANNADA_TEMPLATES.keys():
        for severity in SEVERITIES:
            num_style = random.choice(NUMBERING_STYLES)
            split = "dev" if random.random() < 0.7 else "heldout"
            
            text, expected_clauses = build_document(KANNADA_TEMPLATES[domain], domain, "kan", severity, num_style, doc_index)
            
            doc_id = f"doc_{doc_index:03d}_{domain}_{severity}_kan"
            txt_path = os.path.join(docs_dir, f"{doc_id}.txt")
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(text)
                
            manifest.append({
                "id": doc_id,
                "domain": domain,
                "language": "kan",
                "severity": severity,
                "numbering_style": num_style,
                "split": split,
                "expected_clause_count": len(expected_clauses),
                "clauses": expected_clauses,
                "needs_lawyer_review": True,
                "needs_native_review": True
            })
            doc_index += 1
            
    with open("manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=4, ensure_ascii=False)
        
    print(f"Generated {doc_index-1} synthetic documents in {docs_dir}")
    print("Manifest saved to manifest.json")

if __name__ == "__main__":
    main()
