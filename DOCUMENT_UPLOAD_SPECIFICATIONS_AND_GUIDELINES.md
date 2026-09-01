# Document Upload Specifications, Constraints & Ingestion Guidelines

**System:** CaseCounsel AI Legal Intelligence Microservice  
**Document Compliance Standard:** Digital Personal Data Protection (DPDP) Act 2023 & ISO 27001

---

## 📋 1. Upload Specifications & Constraints

| Parameter / Constraint | Specification Target | Enforcement Mechanism & Error Behavior |
| :--- | :--- | :--- |
| **Supported File Formats** | • **PDF** (`application/pdf`)<br>• **Images**: PNG (`image/png`), JPEG/JPG (`image/jpeg`), WebP (`image/webp`) | Client-side MIME-type validation + Express Multer filter. Invalid formats reject with `400 Bad Request`. |
| **Maximum File Size** | $\le \mathbf{10\text{ MB}}$ per single file | Express Multer `limits: { fileSize: 10 * 1024 * 1024 }`. |
| **Multi-Image Page Aggregation** | Up to $\mathbf{5\text{ images}}$ per upload session | Files are sorted and stitched into a single logical `DocumentSummary` with consecutive `sequenceIndex` pages. Uploading $>5$ images triggers validation warning. |
| **PDF Document Limit** | $\mathbf{1\text{ PDF}}$ per upload session | Multi-PDF batching is blocked to maintain single-contract context isolation. |
| **Recommended Document Length** | $\mathbf{1\text{ to }10\text{ pages}}$ | Optimal OCR & LLM processing latency ($<15\text{s}$). Documents exceeding 15 pages will process but may experience higher OCR extraction time. |
| **Supported Languages & Regional Scripts** | • **English** (Native)<br>• **Kannada** (With archaic Unicode modernization `ಱ` $\rightarrow$ `ರ`, `ೞ` $\rightarrow$ `ಳ`)<br>• **Hindi & Regional Indic Scripts** | Regional scripts undergo Google Neural Translation and normalization before LLM inference. English-dense text ($\ge 70\%$) bypasses translation automatically. |
| **PII Redaction Scope** | • Aadhaar Card Numbers (12 digits)<br>• Permanent Account Numbers (PAN)<br>• Phone Numbers (+91 / 10 digits)<br>• Personal Email Addresses | Microsoft Presidio Legal-NER + regex pattern redaction. Raw identifiers are anonymized with an active offset registry before any AI reasoning. |
| **Data Retention Policy** | $\mathbf{30\text{-Day Automated Purge}}$ | MongoDB TTL index on `createdAt` timestamp automatically expires and removes processed document records. |

---

## ⚖️ 2. Supported Legal Domains & Document Types

The classifier automatically detects and audits contracts in the following legal verticals:

1. **Employment & Service Agreements**: Offer letters, Consultant agreements, Executive employment contracts, Workman covenants.
2. **Rental & Tenancy Agreements**: Residential lease deeds, Commercial tenancy agreements, Sub-lease deeds.
3. **Non-Disclosure Agreements (NDAs)**: Unilateral NDAs, Mutual confidentiality agreements, Trade secret covenants.
4. **Commercial & Vendor Agreements**: Master Service Agreements (MSAs), Service Level Agreements (SLAs), Sale deeds.
5. **Statutory Benefits & Social Security**: Gratuity claims, Provident fund agreements, Retrenchment notices.

---

## 🧪 3. Recommended Live Test Suite (4 Scenarios)

To verify the system end-to-end on the live application, test these 4 distinct document scenarios:

---

### Scenario A: Standard Compliant Employment Agreement (Clean Truth Summary Test)
* **Goal:** Verify accurate extraction of 7 truth entities with 🟢 `NO_ISSUE_DETECTED` and zero false alarms.
* **Test Text:**
```text
EMPLOYMENT AGREEMENT
This Employment Agreement is made on 1st November 2024 between CloudNova Technologies Pvt Ltd ("Employer") and Rohan Verma ("Employee").

1. Engagement & Duties: The Employee is appointed as Senior Software Engineer. The Employee will perform system engineering and backend development.
2. Remuneration: The Employer shall pay a monthly gross salary of ₹1,40,000/-, payable on the 1st of each calendar month. An annual bonus of ₹1,80,000/- is subject to performance review on 31st March.
3. Confidentiality: The Employee agrees to keep all company confidential information and trade secrets strictly secure during and after tenure.
4. Termination & Notice: Either party may terminate this agreement by providing 30 days prior written notice or gross salary in lieu thereof.
5. Governing Law: This agreement shall be governed by the laws of India and subject to the jurisdiction of the courts at Bengaluru, Karnataka.
```

---

### Scenario B: High-Risk Toxic Employment Contract (Red & Blue Flags Test)
* **Goal:** Verify Route A & Route B trigger 🔴 `HIGH_RISK` and 🔵 `ONE_SIDED` calibrated badges with statutory citations.
* **Test Text:**
```text
EXECUTIVE EMPLOYMENT AGREEMENT
This Agreement is entered into between Apex Corp Pvt Ltd ("Employer") and Ananya Roy ("Employee").

1. Restrictive Covenants: The Employee strictly agrees that for a period of 24 months following termination of employment for any reason, the Employee shall not directly or indirectly work for, consult with, or engage in any business competing with the Employer across India.
2. Asymmetric Termination: The Employer reserves the absolute right to terminate the Employee immediately without any prior notice or compensation. The Employee must provide a mandatory 90-day prior written notice before resigning.
3. Waiver of Statutory Benefits: The Employee hereby voluntarily forfeits and waives all claims to statutory gratuity and retrenchment compensation under all applicable labour enactments.
4. Bar on Legal Proceedings: Any disputes arising hereunder shall be settled solely by internal company management. The Employee expressly agrees not to institute any legal proceedings, injunctions, or suits in any court of law or judicial tribunal.
```

---

### Scenario C: Residential Rental Lease Agreement (Lease & Deposit Test)
* **Goal:** Verify property domain classification, financial schedule extraction (Rent ₹45,000 vs Deposit ₹3,00,000), and auto-routing to Property Law lawyers.
* **Test Text:**
```text
RESIDENTIAL LEASE AGREEMENT
This Agreement is made on 1st August 2024 between Mr. S. K. Narayana (Lessor) and Ms. Priyanka Sen (Lessee).

1. Demised Premises: Flat No. 402, Green Glen Heights, Bellandur, Bengaluru.
2. Monthly Rent & Maintenance: The Lessee shall pay a monthly rent of ₹45,000/- on or before the 5th of each calendar month.
3. Security Deposit: The Lessee has deposited an interest-free refundable security deposit of ₹3,00,000/- with the Lessor.
4. Lease Tenure & Lock-in: The lease duration is 11 months with a mandatory lock-in period of 6 months.
5. Notice Period: Either party may terminate the tenancy by providing 2 months written notice after the lock-in period.
6. Governing Law: Governed by the Karnataka Rent Control laws and Transfer of Property Act 1882 with jurisdiction in Bengaluru courts.
```

---

### Scenario D: Regional Script Document (Kannada OCR & Modernization Test)
* **Goal:** Verify archaic Kannada normalization (`ಱ` $\rightarrow$ `ರ`), neural translation, and PII anonymization.
* **Test Text:**
```text
ಬಾಡಿಗೆ ಕರಾರು ಪತ್ರ (Rental Agreement)
ದಿನಾಂಕ 15ನೇ ಜುಲೈ 2024 ರಂದು ಬೆಂಗಳೂರಿನಲ್ಲಿ ಮಾಡಿಕೊಂಡ ಒಪ್ಪಂದ.
ಮಾಲೀಕರು: ರಾಜೇಶ್ ಕುಮಾರ್ ಶರ್ಮಾ. ಬಾಡಿಗೆದಾರರು: ಅನನ್ಯ ಅಯ್ಯರ್.
ತಿಂಗಳ ಬಾಡಿಗೆ: ₹35,000/-. ಮುಂಗಡ ಠೇವಣಿ: ₹2,00,000/-.
ಗಮನಿಸಿ: ಎರಡೂ ಕಡೆಯವರು 1 ತಿಂಗಳ ಲಿಖಿತ ಮುನ್ಸೂಚನೆ (Notice) ನೀಡಿ ಒಪ್ಪಂದವನ್ನು ಕೊನೆಗೊಳಿಸಬಹುದು.
ನ್ಯಾಯವ್ಯಾಪ್ತಿ: ಬೆಂಗಳೂರು ನ್ಯಾಯಾಲಯಗಳು.
```
