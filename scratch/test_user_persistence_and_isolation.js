module.paths.push('./server/node_modules');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const assert = require('assert');
const express = require('express');

// Set env variables
process.env.NODE_ENV = 'test';
dotenv.config({ path: './server/.env' });

const connectDB = require('../server/utils/db');
const aiRoutes = require('../server/routes/aiRoutes');
const DocumentSummary = require('../server/models/DocumentSummary');
const OriginalDocument = require('../server/models/OriginalDocument');

async function runPersistenceAndIsolationTests() {
  console.log('=== Test Suite: User-Scoped Analysis Persistence & Cross-User Isolation ===\n');

  try {
    await connectDB();
    console.log('✅ Connected to MongoDB.');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRoutes);

  const server = app.listen(5000, () => {
    console.log('✅ Test API Server listening on port 5000.\n');
  });

  const USER_A_TOKEN = 'test-token-uid-alice';
  const USER_B_TOKEN = 'test-token-uid-bob';

  // Clean up any old test documents for alice and bob
  await DocumentSummary.deleteMany({ userId: { $in: [USER_A_TOKEN, USER_B_TOKEN] } });
  await OriginalDocument.deleteMany({ userId: { $in: [USER_A_TOKEN, USER_B_TOKEN] } });

  // Prepare a mock 1x1 PNG image
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const pngBuffer = Buffer.from(pngBase64, 'base64');

  try {
    // ----------------------------------------------------
    // TEST 1: User A uploads first document
    // ----------------------------------------------------
    console.log('--- Step 1: User A (Alice) uploads Document 1 ---');
    const blob1 = new Blob([pngBuffer], { type: 'image/png' });
    const formData1 = new FormData();
    formData1.append('documents', blob1, 'alice_rental_agreement.png');

    const uploadRes1 = await fetch('http://localhost:5000/api/ai/extract', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${USER_A_TOKEN}` },
      body: formData1
    });

    const uploadData1 = await uploadRes1.json();
    assert.strictEqual(uploadRes1.status, 200, `Upload 1 failed with status ${uploadRes1.status}`);
    const docId1 = uploadData1.documentId;
    assert.ok(docId1, 'Must receive documentId for upload 1');
    console.log(`Uploaded Document 1 (ID: ${docId1})`);
    console.log('✅ Step 1 PASS\n');

    // ----------------------------------------------------
    // TEST 2: User A retrieves latest document
    // ----------------------------------------------------
    console.log('--- Step 2: User A fetches /documents/latest ---');
    const latestResA = await fetch('http://localhost:5000/api/ai/documents/latest', {
      headers: { 'Authorization': `Bearer ${USER_A_TOKEN}` }
    });
    const latestDataA = await latestResA.json();
    assert.strictEqual(latestResA.status, 200);
    assert.strictEqual(latestDataA.documentId, docId1, 'Latest document must match docId1');
    assert.ok(latestDataA.riskAnalysis !== undefined, 'Must return riskAnalysis');
    assert.ok(latestDataA.summaryOutput !== undefined, 'Must return summaryOutput');
    console.log(`Retrieved latest document for User A: ${latestDataA.fileName} (ID: ${latestDataA.documentId})`);
    console.log('✅ Step 2 PASS\n');

    // ----------------------------------------------------
    // TEST 3: User A uploads second document
    // ----------------------------------------------------
    console.log('--- Step 3: User A uploads Document 2 ---');
    const blob2 = new Blob([pngBuffer], { type: 'image/png' });
    const formData2 = new FormData();
    formData2.append('documents', blob2, 'alice_employment_contract.png');

    const uploadRes2 = await fetch('http://localhost:5000/api/ai/extract', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${USER_A_TOKEN}` },
      body: formData2
    });

    const uploadData2 = await uploadRes2.json();
    assert.strictEqual(uploadRes2.status, 200);
    const docId2 = uploadData2.documentId;
    console.log(`Uploaded Document 2 (ID: ${docId2})`);

    // Verify User A now has 2 documents in history
    const listResA = await fetch('http://localhost:5000/api/ai/documents', {
      headers: { 'Authorization': `Bearer ${USER_A_TOKEN}` }
    });
    const listDataA = await listResA.json();
    assert.strictEqual(listResA.status, 200);
    assert.strictEqual(listDataA.documents.length, 2, 'User A must have exactly 2 documents in history');
    assert.strictEqual(listDataA.documents[0].documentId, docId2, 'Most recent document must be first in list');
    console.log(`User A Document List Count: ${listDataA.documents.length} (Latest: ${listDataA.documents[0].fileName})`);
    console.log('✅ Step 3 PASS\n');

    // ----------------------------------------------------
    // TEST 4: Cross-User Isolation (User B reads history & latest)
    // ----------------------------------------------------
    console.log('--- Step 4: User B (Bob) queries history (Cross-User Isolation) ---');
    const listResB = await fetch('http://localhost:5000/api/ai/documents', {
      headers: { 'Authorization': `Bearer ${USER_B_TOKEN}` }
    });
    const listDataB = await listResB.json();
    assert.strictEqual(listResB.status, 200);
    assert.strictEqual(listDataB.documents.length, 0, 'User B must see 0 documents (Strict Isolation)');
    console.log(`User B Document List Count: ${listDataB.documents.length} (Zero leakage from User A)`);

    const latestResB = await fetch('http://localhost:5000/api/ai/documents/latest', {
      headers: { 'Authorization': `Bearer ${USER_B_TOKEN}` }
    });
    assert.strictEqual(latestResB.status, 404, 'User B latest doc must return 404 Not Found');
    console.log('User B /documents/latest: 404 Not Found (Clean isolation)');
    console.log('✅ Step 4 PASS\n');

    // ----------------------------------------------------
    // TEST 5: Unauthorized Direct Document Access
    // ----------------------------------------------------
    console.log("--- Step 5: User B attempts to directly access User A's Document ID ---");
    const directResB = await fetch(`http://localhost:5000/api/ai/documents/${docId1}`, {
      headers: { 'Authorization': `Bearer ${USER_B_TOKEN}` }
    });
    assert.strictEqual(directResB.status, 404, 'User B must be rejected with 404 when accessing User A document');
    console.log(`User B direct access to docId1 blocked: ${directResB.status}`);
    console.log('✅ Step 5 PASS\n');

    // ----------------------------------------------------
    // TEST 6: User A deletes Document 1
    // ----------------------------------------------------
    console.log('--- Step 6: User A deletes Document 1 ---');
    const deleteRes = await fetch(`http://localhost:5000/api/ai/documents/${docId1}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${USER_A_TOKEN}` }
    });
    assert.strictEqual(deleteRes.status, 200);

    const listResAfterDelete = await fetch('http://localhost:5000/api/ai/documents', {
      headers: { 'Authorization': `Bearer ${USER_A_TOKEN}` }
    });
    const listDataAfterDelete = await listResAfterDelete.json();
    assert.strictEqual(listDataAfterDelete.documents.length, 1, 'User A must have 1 document remaining after delete');
    assert.strictEqual(listDataAfterDelete.documents[0].documentId, docId2);
    console.log(`User A Remaining Documents: ${listDataAfterDelete.documents.length} (${listDataAfterDelete.documents[0].fileName})`);
    console.log('✅ Step 6 PASS\n');

    console.log('================================================================');
    console.log('🎉 ALL PERSISTENCE & CROSS-USER ISOLATION TESTS PASSED (100%)');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Test Assertion Failed:', err);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.connection.close();
  }
}

runPersistenceAndIsolationTests();
