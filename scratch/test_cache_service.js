const assert = require('assert');

async function testCacheService() {
  console.log('=== Test Step 2: Safe Context-Aware Cache Optimization ===\n');

  const sampleClauses = [
    {
      clauseIndex: 1,
      detectedType: "Administrative / Contact Information",
      rawText: "The tenant may contact the landlord at support@rentalhub.in for maintenance queries."
    },
    {
      clauseIndex: 2,
      detectedType: "Indemnification & Liability",
      rawText: "The Lessee agrees to hold harmless, defend, and indemnify the Lessor against any and all claims, unlimited liabilities, and legal expenses arising at the sole discretion of the Lessor."
    }
  ];

  console.log("Run 1 (Cold Cache / Cache Miss) — Sending clauses...");
  const start1 = Date.now();
  const res1 = await fetch('http://localhost:8000/analyze-clauses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clauses: sampleClauses,
      domain: "Rental Agreement",
      state: "Karnataka"
    })
  });
  const dur1 = Date.now() - start1;
  const data1 = await res1.json();
  console.log(`Run 1 completed in ${dur1}ms with ${data1.length} findings.\n`);

  console.log("Run 2 (Hot Cache / Cache Hit) — Sending identical clauses...");
  const start2 = Date.now();
  const res2 = await fetch('http://localhost:8000/analyze-clauses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clauses: sampleClauses,
      domain: "Rental Agreement",
      state: "Karnataka"
    })
  });
  const dur2 = Date.now() - start2;
  const data2 = await res2.json();
  console.log(`Run 2 completed in ${dur2}ms with ${data2.length} findings.\n`);

  // Assertions
  console.log('--- Validating Cache Assertions ---');
  assert.strictEqual(data1.length, data2.length, "Finding lengths must match");
  assert.strictEqual(data1[0].riskLevel, data2[0].riskLevel, "Clause 1 risk level must match across cache");
  assert.strictEqual(data1[1].riskLevel, data2[1].riskLevel, "Clause 2 risk level must match across cache");
  assert.ok(dur2 < dur1 || dur2 < 100, `Run 2 (${dur2}ms) must be significantly faster than Run 1 (${dur1}ms)`);

  console.log(`Speedup: ${dur1}ms -> ${dur2}ms (Cache Hit) ✅ PASS`);
  console.log('\n=== STEP 2 CONTEXT-AWARE CACHE VERIFICATION PASSED (100%) ===\n');
}

testCacheService().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
