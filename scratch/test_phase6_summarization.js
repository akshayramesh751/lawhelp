module.paths.push('./server/node_modules');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './server/.env' });

process.env.NODE_ENV = 'test';
const connectDB = require('../server/utils/db');
const OriginalDocument = require('../server/models/OriginalDocument');
const DocumentSummary = require('../server/models/DocumentSummary');

async function testPhase6Summarization() {
  console.log('=== Test Phase 6: Document Truth Summarization Pipeline ===\n');

  const sampleEmploymentDoc = `
EMPLOYMENT AGREEMENT
This Employment Agreement is entered into on 1st October 2024 between CloudNova Technologies Pvt Ltd ("Employer") and Vikramaditya Rao ("Employee").

1. Position and Duties
The Employee is engaged as Principal Solutions Architect. The Employee shall perform software development, system design, and architectural governance.

2. Compensation and Financial Terms
The Employer shall pay the Employee a fixed base gross salary of ₹1,80,000/- per month, payable on or before the 1st business day of each succeeding month. A performance bonus of ₹2,50,000/- shall be evaluated annually on 31st March.

3. Confidentiality and Intellectual Property
The Employee covenants to maintain strict confidentiality of all trade secrets and assigns all intellectual property created during employment to the Employer.

4. Termination and Notice
Either party may terminate this agreement by providing 60 days prior written notice. The Employer may terminate immediately without notice in case of gross proven misconduct.

5. Governing Law and Jurisdiction
This agreement shall be governed by the laws of India, and the courts at Bengaluru, Karnataka shall have exclusive jurisdiction.
  `;

  const sampleRentalDoc = `
RESIDENTIAL LEASE AGREEMENT
This Agreement of Lease is made on 15th July 2024 between Mr. S. K. Narayana (Lessor) and Ms. Priyanka Sen (Lessee).

1. Demised Premises
The Lessor grants on lease the residential apartment Flat No. 402, Green Glen Heights, Bellandur, Bengaluru.

2. Rent and Security Deposit
The monthly rent is fixed at ₹55,000/- payable on or before the 5th of each calendar month. The Lessee has paid an interest-free refundable security deposit of ₹3,50,000/- via bank transfer.

3. Lease Tenure and Lock-in
The lease tenure shall be for a duration of 11 months with a mandatory lock-in period of 6 months.

4. Notice and Vacating
Either party may terminate the lease by giving 2 months written notice after the lock-in period.

5. Governing Law
Governed by Transfer of Property Act 1882 and Karnataka Rent Control laws with jurisdiction of Bengaluru courts.
  `;

  // Test Suite 1: Direct Python Summarizer Endpoint
  console.log('--- Test Suite 1: Direct Python /summarize-document Endpoint ---');
  try {
    const res1 = await fetch('http://localhost:8000/summarize-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: sampleEmploymentDoc,
        domain: "Employment Contract"
      })
    });

    const summary1 = await res1.json();
    console.log('Employment Agreement Summary Output:');
    console.log(`- Executive Summary: ${summary1.executiveSummary}`);
    console.log(`- Rights Count: ${summary1.rights?.length}`);
    console.log(`- Obligations Count: ${summary1.obligations?.length}`);
    console.log(`- Financial Terms:`, JSON.stringify(summary1.financialTerms, null, 2));
    console.log(`- Termination Conditions:`, summary1.terminationConditions);
    console.log(`- Milestones:`, summary1.deadlinesAndMilestones);
    console.log(`- Governing Law: ${summary1.governingLaw}`);

    // Assertions for Employment Doc
    console.log('\n--- Assertions for Employment Doc ---');
    console.log(`Executive Summary Present: ${Boolean(summary1.executiveSummary && summary1.executiveSummary.length > 20) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Rights Array Valid: ${Array.isArray(summary1.rights) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Obligations Array Valid: ${Array.isArray(summary1.obligations) && summary1.obligations.length > 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Financial Terms Structured: ${Array.isArray(summary1.financialTerms) && summary1.financialTerms.length > 0 && Boolean(summary1.financialTerms[0].amount) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Termination Conditions Present: ${Array.isArray(summary1.terminationConditions) && summary1.terminationConditions.length > 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Governing Law Extracted: ${Boolean(summary1.governingLaw && (summary1.governingLaw.includes('India') || summary1.governingLaw.includes('Bengaluru'))) ? '✅ PASS' : '❌ FAIL'}`);

  } catch (err) {
    console.error('Test Suite 1 failed:', err);
  }

  // Test Suite 2: Rental Document Summarization
  console.log('\n--- Test Suite 2: Rental Document Summarization ---');
  try {
    const res2 = await fetch('http://localhost:8000/summarize-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: sampleRentalDoc,
        domain: "Rental Agreement"
      })
    });

    const summary2 = await res2.json();
    console.log('Rental Agreement Summary Output:');
    console.log(`- Executive Summary: ${summary2.executiveSummary}`);
    console.log(`- Financial Terms:`, JSON.stringify(summary2.financialTerms, null, 2));
    console.log(`- Termination Conditions:`, summary2.terminationConditions);

    console.log('\n--- Assertions for Rental Doc ---');
    console.log(`Executive Summary Present: ${Boolean(summary2.executiveSummary && summary2.executiveSummary.length > 20) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Financial Terms Extracted: ${Array.isArray(summary2.financialTerms) && summary2.financialTerms.length > 0 ? '✅ PASS' : '❌ FAIL'}`);

  } catch (err) {
    console.error('Test Suite 2 failed:', err);
  }

  // Test Suite 3: End-to-End Pipeline with MongoDB Persistence
  console.log('\n--- Test Suite 3: End-to-End Pipeline & MongoDB Persistence ---');
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    const testDocId = 'test-phase6-doc-' + Date.now();
    const testUserId = 'test-user-uid-phase6';

    await OriginalDocument.create({
      documentId: testDocId,
      userId: testUserId,
      fileName: 'Employment_Vikramaditya.txt',
      s3Key: 'test/s3/key/' + Date.now(),
      size: 2048,
      sequenceIndex: 0,
      mimeType: 'text/plain',
      status: 'pending'
    });

    // Run through Python full process-document endpoint
    const pyProcessRes = await fetch('http://localhost:8000/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: sampleEmploymentDoc,
        source_language: "en"
      })
    });

    const pyResult = await pyProcessRes.json();
    console.log(`Python Document Processing Complete:`);
    console.log(`- Classification Domain: ${pyResult.classification?.domain}`);
    console.log(`- Summary Output Available: ${Boolean(pyResult.summary_output)}`);
    console.log(`- Risk Analysis Items: ${pyResult.risk_analysis?.length}`);

    // Create DocumentSummary in MongoDB
    const summaryDoc = await DocumentSummary.create({
      originalDocumentId: testDocId,
      originalDocuments: [],
      userId: testUserId,
      documentHash: 'hash-phase6-test',
      pipelineStatus: 'ANALYZED',
      metadata: {
        fileName: 'Employment_Vikramaditya.txt',
        mimeType: 'text/plain',
        detectedLanguage: 'en',
        pageCount: 1,
        wordCount: 120
      },
      textContent: {
        rawOcrText: sampleEmploymentDoc,
        sanitizedRegionalText: pyResult.sanitized_regional_text,
        translatedEnglishText: pyResult.translated_text,
        redactedEnglishText: pyResult.anonymized_text,
        redactedPiiEntities: pyResult.pii_entities
      },
      structure: pyResult.structure,
      summaryOutput: pyResult.summary_output,
      riskAnalysis: pyResult.risk_analysis
    });

    console.log(`Persisted DocumentSummary to MongoDB with ID: ${summaryDoc._id}`);

    // Fetch back and assert
    const fetched = await DocumentSummary.findById(summaryDoc._id);
    console.log(`\nVerifying MongoDB Fetched Record:`);
    console.log(`- Executive Summary: ${fetched.summaryOutput.executiveSummary}`);
    console.log(`- Rights: ${fetched.summaryOutput.rights.length} items`);
    console.log(`- Obligations: ${fetched.summaryOutput.obligations.length} items`);
    console.log(`- Financial Terms: ${fetched.summaryOutput.financialTerms.length} items`);
    console.log(`- Governing Law: ${fetched.summaryOutput.governingLaw}`);

    console.log('\n--- Persistence Assertions ---');
    console.log(`MongoDB Summary Output Valid: ${Boolean(fetched.summaryOutput && fetched.summaryOutput.executiveSummary) ? '✅ PASS' : '❌ FAIL'}`);

    // Cleanup
    await OriginalDocument.deleteMany({ documentId: testDocId });
    await DocumentSummary.deleteMany({ originalDocumentId: testDocId });
    console.log('\nCleaned up test documents from MongoDB.');

  } catch (err) {
    console.error('Test Suite 3 failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }

  console.log('\n=== All Phase 6 Verification Completed Successfully ===\n');
}

testPhase6Summarization();
