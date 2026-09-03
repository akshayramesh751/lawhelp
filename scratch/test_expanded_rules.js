const assert = require('assert');

async function testExpandedRules() {
  console.log('=== Test Step 3: Expanded Deterministic Rules (Route A) ===\n');

  const ruleTestClauses = [
    {
      clauseIndex: 1,
      detectedType: "Termination & Notice",
      rawText: "The Landlord may terminate immediately without notice. The Tenant must provide 90 days prior written notice."
    },
    {
      clauseIndex: 2,
      detectedType: "Administrative / Contact Information",
      rawText: "For all emergency matters and official notices, please contact email address admin@property.com or phone number +91-9876543210."
    },
    {
      clauseIndex: 3,
      detectedType: "Execution & Attestation",
      rawText: "In witness whereof the parties have signed and delivered this agreement on the day and year first above written in the presence of Witness 1 and Witness 2."
    },
    {
      clauseIndex: 4,
      detectedType: "Governing Law & Jurisdiction",
      rawText: "This agreement is governed by the laws of India, and courts at Bengaluru shall have exclusive jurisdiction."
    }
  ];

  console.log("Submitting test clauses to Python /analyze-clauses...");
  const start = Date.now();
  const res = await fetch('http://localhost:8000/analyze-clauses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clauses: ruleTestClauses,
      domain: "Rental Agreement",
      state: "Karnataka"
    })
  });
  const dur = Date.now() - start;
  const findings = await res.json();
  console.log(`Evaluated ${findings.length} findings in ${dur}ms:\n`);

  findings.forEach(f => {
    console.log(`[Clause #${f.clauseIndex} | ${f.clauseType}]`);
    console.log(`- Deterministic Triggered: ${f.deterministicRuleTriggered}`);
    console.log(`- Risk Level: ${f.riskLevel}`);
    console.log(`- Finding: ${f.finding}\n`);
  });

  // Assertions
  assert.strictEqual(findings[0].riskLevel, 'ONE_SIDED', "Clause 1 must be ONE_SIDED");
  assert.strictEqual(findings[0].deterministicRuleTriggered, true, "Clause 1 must trigger Route A deterministic rule");

  assert.strictEqual(findings[1].riskLevel, 'NO_ISSUE_DETECTED', "Clause 2 must be NO_ISSUE_DETECTED");
  assert.strictEqual(findings[1].deterministicRuleTriggered, true, "Clause 2 must trigger Route A deterministic rule");

  assert.strictEqual(findings[2].riskLevel, 'NO_ISSUE_DETECTED', "Clause 3 must be NO_ISSUE_DETECTED");
  assert.strictEqual(findings[2].deterministicRuleTriggered, true, "Clause 3 must trigger Route A deterministic rule");

  assert.strictEqual(findings[3].riskLevel, 'NO_ISSUE_DETECTED', "Clause 4 must be NO_ISSUE_DETECTED");
  assert.strictEqual(findings[3].deterministicRuleTriggered, true, "Clause 4 must trigger Route A deterministic rule");

  console.log('=== STEP 3 EXPANDED DETERMINISTIC RULES VERIFICATION PASSED (100%) ===\n');
}

testExpandedRules().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
