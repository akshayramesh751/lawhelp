const assert = require('assert');

async function runTests() {
  console.log("=== Test Suite: Anti-Hallucination, Strict Legal Grounding & Evidence Gating ===\n");

  const sampleResidentialLease = `
RESIDENTIAL RENTAL AGREEMENT

This Rental Agreement is made and executed on this 1st day of October 2024, by and between:
Mr. Anand Rao, residing at Flat 402, Green Acres, Bengaluru, Karnataka (hereinafter called the LESSOR/OWNER)
AND
Ms. Sneha Kulkarni, residing at Flat 101, Indiranagar, Bengaluru, Karnataka (hereinafter called the LESSEE/TENANT).

1. PREMISES
The Lessor agrees to let out and the Lessee agrees to take on lease the residential premises situated at Flat 304, Palm Grove Apartments, Koramangala 4th Block, Bengaluru, Karnataka.

2. FINANCIAL TERMS
The monthly rent for the scheduled premises shall be ₹42,000/- (Rupees Forty-Two Thousand only) payable on or before the 5th day of each calendar month.
The Lessee has paid an interest-free refundable Security Deposit of ₹2,50,000/- (Rupees Two Lakhs Fifty Thousand only) to the Lessor.
The monthly apartment maintenance charges of ₹4,500/- shall be borne directly by the Lessee.

3. EMERGENCY CONTACT PERSON
In the event of an emergency, the Lessor or building society may contact Mr. Suresh Rao at +91 98765 43210.

4. VEHICLE REGISTRATION
The Lessee is permitted to park one vehicle (Registration No. KA-05-MN-9988) in designated basement slot B-14.

5. SIGNATURES AND WITNESSES
IN WITNESS WHEREOF, the parties hereto have set their hands on the day and year first above written.

LESSOR: Anand Rao
LESSEE: Sneha Kulkarni
WITNESS 1: Ramesh V.
WITNESS 2: Kavita M.
`;

  // 1. Test /process-document endpoint
  console.log("--- Test 1: Document Truth Summarization & Extraction ---");
  const processRes = await fetch('http://localhost:8000/process-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: sampleResidentialLease,
      source_language: 'en'
    })
  });

  assert.strictEqual(processRes.status, 200, "Process document must return 200 OK");
  const docData = await processRes.json();

  console.log("Extracted Domain:", docData.classification.domain);
  console.log("Summary Output:", JSON.stringify(docData.summary_output, null, 2));

  // Assertions for Summarizer Anti-Hallucination
  const sum = docData.summary_output;
  const obligationsText = JSON.stringify(sum.obligations || []).toLowerCase();
  const rightsText = JSON.stringify(sum.rights || []).toLowerCase();
  
  assert(!obligationsText.includes("confidentiality"), "Summary MUST NOT hallucinate confidentiality obligation!");
  assert(!rightsText.includes("dispute resolution"), "Summary MUST NOT hallucinate dispute resolution rights!");
  assert(sum.financialTerms.length >= 3, "Summary must extract the 3 explicit financial amounts");
  assert.strictEqual(sum.governingLaw, "Not specified in the document", "Governing law must be 'Not specified in the document' when absent!");
  console.log("✅ Zero-Hallucination Summarizer Assertions: PASS\n");

  // 2. Test Clause Classification & Neutral Compliance (No Section 10 Default)
  console.log("--- Test 2: Granular Clause Taxonomy & Neutral Compliance ---");
  const clauses = docData.structure.clauses;
  const riskAnalysis = docData.risk_analysis;

  console.log(`Evaluated ${clauses.length} clauses:`);
  clauses.forEach((c, idx) => {
    const risk = riskAnalysis[idx];
    console.log(`[Clause ${c.clauseIndex}: ${c.clauseHeader}] -> Detected Type: "${c.detectedType}" | Risk: ${risk.riskLevel} | Act: ${risk.statutoryConflict.actName}`);
  });

  const contactClause = clauses.find(c => c.clauseHeader.toLowerCase().includes("emergency"));
  const contactRisk = riskAnalysis.find(r => r.clauseIndex === contactClause.clauseIndex);
  assert.strictEqual(contactClause.detectedType, "Administrative / Contact Information", "Contact clause must have granular type");
  assert.strictEqual(contactRisk.riskLevel, "NO_ISSUE_DETECTED", "Contact clause must have NO_ISSUE_DETECTED");
  assert.notStrictEqual(contactRisk.statutoryConflict.actName, "Indian Contract Act, 1872", "Contact clause MUST NOT cite Section 10 ICA blindly");

  const parkingClause = clauses.find(c => c.clauseHeader.toLowerCase().includes("vehicle"));
  const parkingRisk = riskAnalysis.find(r => r.clauseIndex === parkingClause.clauseIndex);
  assert.strictEqual(parkingClause.detectedType, "Premises Use / Parking Permission", "Parking clause must have granular type");
  assert.strictEqual(parkingRisk.riskLevel, "NO_ISSUE_DETECTED", "Parking clause must have NO_ISSUE_DETECTED");
  assert.notStrictEqual(parkingRisk.statutoryConflict.actName, "Indian Contract Act, 1872", "Parking clause MUST NOT cite Section 10 ICA blindly");

  console.log("✅ Granular Taxonomy & Neutral Compliance: PASS\n");

  // 3. Test Chatbot 3-Tier Evidence Gating & Absence Handling
  console.log("--- Test 3: Chatbot 3-Tier Evidence Gating & Absence Handling ---");

  // Query A: Non-compete on Rental Agreement (Absence Test)
  console.log("Query A: 'Are there any restrictive non-compete clauses?'");
  const chatResA = await fetch('http://localhost:8000/chat-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "Are there any restrictive non-compete clauses?",
      doc_context: {
        summaryOutput: docData.summary_output,
        riskAnalysis: docData.risk_analysis,
        structure: docData.structure
      },
      domain: docData.classification.domain
    })
  });
  const chatDataA = await chatResA.json();
  console.log("Chat A Reply:\n", chatDataA.reply);
  assert(chatDataA.reply.toLowerCase().includes("no non-compete clause") || chatDataA.reply.toLowerCase().includes("not contain"), "Chatbot must explicitly state non-compete clause is absent!");
  console.log("✅ Absence Query A (Non-Compete): PASS\n");

  // Query B: Late rent / default consequences (Absence + Statutory separation Test)
  console.log("Query B: 'What will happen if I miss my rent payment for a long time?'");
  const chatResB = await fetch('http://localhost:8000/chat-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "What will happen if I miss my rent payment for a long time?",
      doc_context: {
        summaryOutput: docData.summary_output,
        riskAnalysis: docData.risk_analysis,
        structure: docData.structure
      },
      domain: docData.classification.domain
    })
  });
  const chatDataB = await chatResB.json();
  console.log("Chat B Reply:\n", chatDataB.reply);
  assert(chatDataB.reply.toLowerCase().includes("no explicit clause") || chatDataB.reply.toLowerCase().includes("does not specify") || chatDataB.reply.toLowerCase().includes("contains no"), "Chatbot must state that default penalties/eviction terms are not explicitly specified in the agreement!");
  console.log("✅ Query B (Missed Rent Absence & Statutory Separation): PASS\n");

  // Query C: Termination Notice (Domain Isolation: Must not cite Karnataka Shops Act!)
  console.log("Query C: 'What is my required notice period for termination?'");
  const chatResC = await fetch('http://localhost:8000/chat-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "What is my required notice period for termination?",
      doc_context: {
        summaryOutput: docData.summary_output,
        riskAnalysis: docData.risk_analysis,
        structure: docData.structure
      },
      domain: docData.classification.domain
    })
  });
  const chatDataC = await chatResC.json();
  console.log("Chat C Reply:\n", chatDataC.reply);
  const citationsC = JSON.stringify(chatDataC.citations || []).toLowerCase();
  assert(!citationsC.includes("karnataka shops"), "Rental agreement MUST NOT cite Karnataka Shops Act!");
  console.log("✅ Query C (Strict Domain Isolation): PASS\n");

  console.log("=== ALL ANTI-HALLUCINATION & EVIDENCE GATING TESTS PASSED (100%) ===");
}

runTests().catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
