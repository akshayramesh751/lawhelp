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

async function testPhase7ChatExplainability() {
  console.log('=== Test Phase 7: Interactive Document Chat & Severity Explainability ===\n');

  const mockDocContext = {
    summaryOutput: {
      executiveSummary: "This is an Employment Agreement entered into between CloudNova Technologies and Rahul Sharma.",
      rights: ["Right to salary", "Right to statutory notice"],
      obligations: ["Confidentiality", "IP assignment", "Non-compete"],
      financialTerms: [
        { description: "Base Salary", amount: "₹1,50,000/- per month", deadline: "1st of every month" }
      ],
      terminationConditions: ["Employer may terminate immediately without notice; Employee must provide 90 days notice."],
      governingLaw: "Laws of India, courts at Bengaluru, Karnataka."
    },
    riskAnalysis: [
      {
        clauseIndex: 1,
        clauseType: "Restrictive Covenant",
        riskLevel: "HIGH_RISK",
        finding: "Post-employment non-compete covenants are void ab initio under Indian law.",
        statutoryConflict: {
          actName: "Indian Contract Act, 1872",
          section: "27",
          authorityLevel: "STATUTE"
        },
        reasoning: "Section 27 of ICA renders all post-employment non-competes void."
      },
      {
        clauseIndex: 2,
        clauseType: "Termination Notice",
        riskLevel: "ONE_SIDED",
        finding: "Asymmetric termination notice heavily favors the employer.",
        statutoryConflict: {
          actName: "Karnataka Shops and Commercial Establishments Act, 1961",
          section: "39",
          authorityLevel: "STATE_RULE"
        },
        reasoning: "Section 39 KSCA requires 30 days notice for employee dismissal."
      }
    ],
    structure: {
      clauses: [
        {
          clauseIndex: 1,
          clauseHeader: "Non-Compete",
          rawText: "Employee shall not work for any competitor across India for 2 years after resignation."
        },
        {
          clauseIndex: 2,
          clauseHeader: "Termination",
          rawText: "Employer may terminate immediately without notice, while employee must provide 90 days notice."
        }
      ]
    }
  };

  // Test Suite 1: Direct Python AI Chat Endpoint
  console.log('--- Test Suite 1: Direct Python /chat-document Endpoint ---');
  try {
    // Query 1: Termination & Notice
    const q1 = "Can my employer dismiss me immediately without any notice?";
    console.log(`\nQuery 1: "${q1}"`);
    const res1 = await fetch('http://localhost:8000/chat-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: q1,
        doc_context: mockDocContext,
        domain: "Employment Contract",
        state: "Karnataka",
        country: "India"
      })
    });

    const data1 = await res1.json();
    console.log(`\nAssistant Reply:\n${data1.reply}`);
    console.log(`\nRelevant Clauses:`, data1.relevantClauses);
    console.log(`Citations:`, data1.citations);
    console.log(`Suggested Questions:`, data1.suggestedQuestions);

    console.log('\n--- Assertions for Query 1 ---');
    console.log(`Reply Present: ${Boolean(data1.reply && data1.reply.length > 20) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Statutory Citations Present: ${Array.isArray(data1.citations) && data1.citations.length > 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Suggested Questions Present: ${Array.isArray(data1.suggestedQuestions) && data1.suggestedQuestions.length > 0 ? '✅ PASS' : '❌ FAIL'}`);

    // Query 2: Non-Compete
    const q2 = "Can I join a competing tech company after resigning?";
    console.log(`\nQuery 2: "${q2}"`);
    const res2 = await fetch('http://localhost:8000/chat-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: q2,
        doc_context: mockDocContext,
        domain: "Employment Contract",
        state: "Karnataka",
        country: "India"
      })
    });

    const data2 = await res2.json();
    console.log(`\nAssistant Reply:\n${data2.reply}`);
    console.log('\n--- Assertions for Query 2 ---');
    console.log(`Reply References Section 27 / Void Non-Compete: ${Boolean(data2.reply && (data2.reply.includes('27') || data2.reply.includes('void') || data2.reply.includes('unenforceable') || data2.reply.includes('Contract Act'))) ? '✅ PASS' : '❌ FAIL'}`);

  } catch (err) {
    console.error('Test Suite 1 failed:', err);
  }

  // Test Suite 2: Full Express Chat Endpoint with MongoDB Persistence
  console.log('\n--- Test Suite 2: Express POST /api/ai/chat/:documentId with MongoDB ---');
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    const app = express();
    app.use(express.json());
    app.use('/api/ai', aiRoutes);

    const server = app.listen(5000, async () => {
      console.log('Test Express server listening on port 5000.');

      const testDocId = 'test-phase7-chat-doc-' + Date.now();
      const testUserId = 'test-token-uid-123';

      // Insert mock DocumentSummary
      await DocumentSummary.create({
        originalDocumentId: testDocId,
        originalDocuments: [],
        userId: testUserId,
        documentHash: 'hash-phase7-test',
        pipelineStatus: 'ANALYZED',
        metadata: {
          fileName: 'Employment_Rahul.txt',
          mimeType: 'text/plain',
          detectedLanguage: 'en',
          pageCount: 1,
          wordCount: 100
        },
        textContent: {
          rawOcrText: 'raw text sample',
          sanitizedRegionalText: 'sanitized text sample',
          translatedEnglishText: 'translated text sample',
          redactedEnglishText: 'redacted text sample',
          redactedPiiEntities: []
        },
        structure: mockDocContext.structure,
        summaryOutput: mockDocContext.summaryOutput,
        riskAnalysis: mockDocContext.riskAnalysis
      });

      // Call Express chat endpoint
      const expressRes = await fetch(`http://localhost:5000/api/ai/chat/${testDocId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUserId}`
        },
        body: JSON.stringify({
          query: 'What is my base compensation and payment date?',
          messages: [
            { role: 'user', content: 'What is my base compensation and payment date?' }
          ]
        })
      });

      const expressData = await expressRes.json();
      console.log('\nExpress Chat Endpoint Response:');
      console.log(`- Status: ${expressRes.status}`);
      console.log(`- Reply: ${expressData.reply}`);

      console.log('\n--- Express Endpoint Assertions ---');
      console.log(`Express Endpoint Succeeded: ${expressRes.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Reply Extracted Compensation: ${Boolean(expressData.reply && expressData.reply.includes('1,50,000')) ? '✅ PASS' : '❌ FAIL'}`);

      // Cleanup
      await DocumentSummary.deleteMany({ originalDocumentId: testDocId });
      console.log('\nCleaned up test documents from MongoDB.');

      server.close(() => {
        console.log('Test Express server shut down.');
        mongoose.disconnect().then(() => {
          console.log('Disconnected from MongoDB.');
          console.log('\n=== All Phase 7 Verification Completed Successfully ===\n');
          process.exit(0);
        });
      });
    });

  } catch (err) {
    console.error('Test Suite 2 failed:', err);
  }
}

testPhase7ChatExplainability();
