const assert = require('assert');

async function testBatchClauseAnalyzer() {
  console.log('=== Test Step 1: Route B Clause Batch Builder Optimization ===\n');

  const testClauses = [
    {
      clauseIndex: 1,
      detectedType: "Premises / Demised Property",
      rawText: "The Lessor agrees to lease residential Flat No. 301, Brigade Orchards, Devanahalli, Bengaluru to the Lessee."
    },
    {
      clauseIndex: 2,
      detectedType: "Restrictive Covenant",
      rawText: "The Employee agrees that for a period of 24 months following termination of employment, they shall not engage in any competing business in India."
    },
    {
      clauseIndex: 3,
      detectedType: "Termination & Notice",
      rawText: "The Employer may terminate this contract with immediate effect without notice. The Employee must give 90 days prior written notice."
    },
    {
      clauseIndex: 4,
      detectedType: "Administrative / Contact Information",
      rawText: "For all emergency matters and official notices, the tenant may contact the property manager at manager@orchards.com or +91-9876543210."
    },
    {
      clauseIndex: 5,
      detectedType: "Indemnification & Liability",
      rawText: "The Lessee agrees to hold harmless, defend, and indemnify the Lessor against any and all claims, unlimited liabilities, and legal expenses arising at the sole discretion of the Lessor."
    },
    {
      clauseIndex: 6,
      detectedType: "Governing Law & Jurisdiction",
      rawText: "This agreement is governed by the laws of India, and courts at Bengaluru shall have exclusive jurisdiction."
    }
  ];

  console.log(`Submitting ${testClauses.length} clauses to Python /analyze-clauses endpoint...`);
  
  const startTime = Date.now();
  const response = await fetch('http://localhost:8000/analyze-clauses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clauses: testClauses,
      domain: "Rental Agreement",
      state: "Karnataka"
    })
  });

  const durationMs = Date.now() - startTime;
  assert.strictEqual(response.status, 200, `Expected 200 OK, got ${response.status}`);

  const results = await response.json();
  console.log(`Received ${results.length} evaluated findings in ${durationMs}ms:\n`);

  results.forEach((r) => {
    console.log(`[Clause #${r.clauseIndex} | ${r.clauseType}]`);
    console.log(`- Risk Level: ${r.riskLevel}`);
    console.log(`- Finding: ${r.finding}`);
    console.log(`- Statutory Conflict: ${r.statutoryConflict?.actName || 'N/A'} (§ ${r.statutoryConflict?.section || 'N/A'})`);
    console.log(`- Deterministic Triggered: ${r.deterministicRuleTriggered}`);
    console.log(`- Confidence: ${r.confidenceScore}\n`);
  });

  // Assertions
  console.log('--- Validating Assertions ---');
  assert.strictEqual(results.length, 6, "Must return exactly 6 evaluated findings");
  
  const c1 = results.find(r => r.clauseIndex === 1);
  assert.strictEqual(c1.riskLevel, 'NO_ISSUE_DETECTED', "Clause 1 (Premises) must be NO_ISSUE_DETECTED");
  console.log("Clause 1 (Premises -> NO_ISSUE_DETECTED): ✅ PASS");

  const c2 = results.find(r => r.clauseIndex === 2);
  assert.strictEqual(c2.riskLevel, 'HIGH_RISK', "Clause 2 (Non-compete) must be HIGH_RISK");
  assert.strictEqual(c2.deterministicRuleTriggered, true, "Clause 2 must trigger Route A deterministic rule");
  console.log("Clause 2 (Non-compete -> HIGH_RISK via Route A): ✅ PASS");

  const c3 = results.find(r => r.clauseIndex === 3);
  assert.ok(['HIGH_RISK', 'ONE_SIDED'].includes(c3.riskLevel), "Clause 3 (Asymmetric notice) must be ONE_SIDED or HIGH_RISK");
  console.log("Clause 3 (Asymmetric notice -> ONE_SIDED): ✅ PASS");

  const c4 = results.find(r => r.clauseIndex === 4);
  assert.strictEqual(c4.riskLevel, 'NO_ISSUE_DETECTED', "Clause 4 (Contact info) must be NO_ISSUE_DETECTED");
  console.log("Clause 4 (Contact Info -> NO_ISSUE_DETECTED): ✅ PASS");

  const c5 = results.find(r => r.clauseIndex === 5);
  assert.ok(['ONE_SIDED', 'HIGH_RISK', 'REQUIRES_REVIEW'].includes(c5.riskLevel), "Clause 5 (Uncapped indemnity) must be flagged");
  console.log("Clause 5 (Uncapped indemnity -> Flagged): ✅ PASS");

  const c6 = results.find(r => r.clauseIndex === 6);
  assert.strictEqual(c6.riskLevel, 'NO_ISSUE_DETECTED', "Clause 6 (Governing Law) must be NO_ISSUE_DETECTED");
  console.log("Clause 6 (Governing Law -> NO_ISSUE_DETECTED): ✅ PASS");

  console.log('\n=== STEP 1 BATCH BUILDER VERIFICATION PASSED (100%) ===\n');
}

testBatchClauseAnalyzer().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
