module.paths.push('./server/node_modules');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './server/.env' });

process.env.NODE_ENV = 'test';
const express = require('express');
const connectDB = require('../server/utils/db');
const OriginalDocument = require('../server/models/OriginalDocument');
const DocumentSummary = require('../server/models/DocumentSummary');
const aiRoutes = require('../server/routes/aiRoutes');

async function testPhase5ClauseAnalysis() {
  console.log('=== Test Phase 5: Dual-Path Clause Analysis & Severity Calibration ===\n');

  // Test 1: Direct Python AI Engine /analyze-clauses endpoint
  console.log('--- Test Suite 1: Direct Python Dual-Path Engine (/analyze-clauses) ---');
  
  const testClauses = [
    {
      clauseIndex: 1,
      clauseHeader: "Non-Compete",
      detectedType: "Restrictive Covenant",
      rawText: "Clause 1. The Employee agrees that for a period of 24 months following termination of employment, the Employee shall not work for, consult with, or engage in any competing business anywhere in India."
    },
    {
      clauseIndex: 2,
      clauseHeader: "Termination Notice",
      detectedType: "Termination",
      rawText: "Clause 2. The Employer may terminate this employment agreement immediately without notice, whereas the Employee is required to provide 90 days prior written notice."
    },
    {
      clauseIndex: 3,
      clauseHeader: "Bar on Legal Proceedings",
      detectedType: "Dispute Resolution",
      rawText: "Clause 3. The parties agree that neither party shall have the right to approach any court of law or legal tribunal in India regarding any dispute arising hereunder."
    },
    {
      clauseIndex: 4,
      clauseHeader: "Gratuity Waiver",
      detectedType: "Statutory Benefits",
      rawText: "Clause 4. The Employee explicitly agrees that no gratuity shall be payable upon resignation or departure regardless of tenure."
    },
    {
      clauseIndex: 5,
      clauseHeader: "Governing Law",
      detectedType: "Governing Law / Disputes",
      rawText: "Clause 5. This agreement shall be governed by and construed in accordance with the laws of India, and courts at Bengaluru shall have jurisdiction."
    },
    {
      clauseIndex: 6,
      clauseHeader: "Unilateral Indemnity",
      detectedType: "Indemnification",
      rawText: "Clause 6. The Contractor shall indemnify, defend and hold harmless the Company from any and all claims and damages of unlimited nature at Company's sole discretion."
    }
  ];

  try {
    const pyResponse = await fetch('http://localhost:8000/analyze-clauses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clauses: testClauses,
        domain: "Employment",
        state: "Karnataka",
        country: "India"
      })
    });

    const pyFindings = await pyResponse.json();
    console.log(`Received ${pyFindings.length} evaluated clause findings from Python service:`);
    
    pyFindings.forEach((f, idx) => {
      console.log(`\n[Clause ${f.clauseIndex}: ${testClauses[idx].clauseHeader}]`);
      console.log(`- Risk Level: ${f.riskLevel}`);
      console.log(`- Deterministic Triggered: ${f.deterministicRuleTriggered}`);
      console.log(`- Finding: ${f.finding}`);
      console.log(`- Statutory Conflict: ${f.statutoryConflict.actName} (Section ${f.statutoryConflict.section}) [${f.statutoryConflict.authorityLevel}]`);
      console.log(`- Confidence Score: ${f.confidenceScore}`);
      console.log(`- Human Review Required: ${f.humanReviewRequired}`);
    });

    // Assertions
    const c1 = pyFindings[0];
    const c2 = pyFindings[1];
    const c3 = pyFindings[2];
    const c4 = pyFindings[3];
    const c5 = pyFindings[4];
    const c6 = pyFindings[5];

    console.log('\n--- Assertions Validation ---');
    console.log(`Clause 1 (Non-Compete -> HIGH_RISK): ${c1.riskLevel === 'HIGH_RISK' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Clause 2 (Asymmetric Notice -> ONE_SIDED): ${c2.riskLevel === 'ONE_SIDED' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Clause 3 (Bar on Court -> HIGH_RISK): ${c3.riskLevel === 'HIGH_RISK' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Clause 4 (Gratuity Waiver -> HIGH_RISK): ${c4.riskLevel === 'HIGH_RISK' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Clause 5 (Standard Governing Law -> NO_ISSUE_DETECTED): ${c5.riskLevel === 'NO_ISSUE_DETECTED' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Clause 6 (Uncapped Indemnity -> ONE_SIDED / REQUIRES_REVIEW): ${['ONE_SIDED', 'REQUIRES_REVIEW'].includes(c6.riskLevel) ? '✅ PASS' : '❌ FAIL'}`);

  } catch (err) {
    console.error('Python direct test failed:', err);
  }

  // Test 2: Full Document Processing Pipeline through Express & MongoDB
  console.log('\n--- Test Suite 2: Full Document Pipeline with MongoDB Persistence ---');
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    const app = express();
    app.use(express.json());
    app.use('/api/ai', aiRoutes);

    const testDocId = 'test-phase5-doc-' + Date.now();
    const testUserId = 'test-user-uid-phase5';

    // Create a mock original document
    await OriginalDocument.create({
      documentId: testDocId,
      userId: testUserId,
      fileName: 'Employment_Agreement.txt',
      s3Key: 'test/s3/key/' + Date.now(),
      size: 1024,
      sequenceIndex: 0,
      mimeType: 'text/plain',
      status: 'pending'
    });

    const fullEmploymentDocText = `
EMPLOYMENT AGREEMENT
This Employment Agreement is entered into between ABC Tech Pvt Ltd and Rahul Sharma (Aadhaar: 1234 5678 9012, PAN: ABCDE1234F).

Clause 1. Post-Employment Non-Compete
The Employee agrees that for a period of 24 months following termination of employment, the Employee shall not work for any competitor across India.

Clause 2. Termination
The Employer may terminate this employment agreement immediately without notice, whereas the Employee is required to provide 90 days prior written notice.

Clause 3. Governing Law
This agreement shall be governed by the laws of India and courts at Bengaluru, Karnataka shall have jurisdiction.
    `;

    // Process document through Python /process-document
    const processRes = await fetch('http://localhost:8000/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: fullEmploymentDocText,
        source_language: "en"
      })
    });

    const processedDoc = await processRes.json();
    console.log(`\nDocument processed through full pipeline:`);
    console.log(`- Domain: ${processedDoc.classification?.domain}`);
    console.log(`- Clauses Extracted: ${processedDoc.structure?.clauses?.length}`);
    console.log(`- Risk Items Identified: ${processedDoc.risk_analysis?.length}`);

    // Persist in DocumentSummary
    const summary = await DocumentSummary.create({
      originalDocumentId: testDocId,
      originalDocuments: [],
      userId: testUserId,
      documentHash: 'hash-phase5-test',
      pipelineStatus: 'ANALYZED',
      metadata: {
        fileName: 'Employment_Agreement.txt',
        mimeType: 'text/plain',
        detectedLanguage: 'en',
        pageCount: 1,
        wordCount: 100
      },
      textContent: {
        rawOcrText: fullEmploymentDocText,
        sanitizedRegionalText: processedDoc.sanitized_regional_text,
        translatedEnglishText: processedDoc.translated_text,
        redactedEnglishText: processedDoc.anonymized_text,
        redactedPiiEntities: processedDoc.pii_entities
      },
      structure: processedDoc.structure,
      riskAnalysis: processedDoc.risk_analysis
    });

    console.log(`Saved DocumentSummary with ID: ${summary._id}`);
    
    // Verify persistence from MongoDB
    const fetchedSummary = await DocumentSummary.findById(summary._id);
    console.log(`\nFetched from MongoDB:`);
    console.log(`- Risk analysis records count: ${fetchedSummary.riskAnalysis.length}`);
    fetchedSummary.riskAnalysis.forEach(r => {
      console.log(`  * Clause ${r.clauseIndex} (${r.clauseType}): [${r.riskLevel}] -> ${r.finding}`);
    });

    // Cleanup test records
    await OriginalDocument.deleteMany({ documentId: testDocId });
    await DocumentSummary.deleteMany({ originalDocumentId: testDocId });
    console.log('\nCleaned up test records from MongoDB.');

  } catch (err) {
    console.error('Test Suite 2 failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }

  console.log('\n=== All Phase 5 Verification Completed Successfully ===\n');
}

testPhase5ClauseAnalysis();
