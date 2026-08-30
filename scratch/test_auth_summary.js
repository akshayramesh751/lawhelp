module.paths.push('./server/node_modules');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Set env variables
process.env.NODE_ENV = 'test';
dotenv.config({ path: './server/.env' });

const express = require('express');
const connectDB = require('./server/utils/db');
const aiRoutes = require('./server/routes/aiRoutes');

const DocumentSummary = require('./server/models/DocumentSummary');
const OriginalDocument = require('./server/models/OriginalDocument');

async function testAuthSummary() {
  console.log('=== Test 3: Authentication & Reprocessing Endpoint Checks ===\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRoutes);

  const server = app.listen(5000, () => {
    console.log('Test server running on port 5000.');
  });

  const testDocId = 'test-doc-uuid-999';

  try {
    // 1. GET Summary with NO token
    console.log('1. Fetching summary with NO token...');
    const resNoToken = await fetch(`http://localhost:5000/api/ai/summary/${testDocId}`);
    console.log(`- Response status: ${resNoToken.status} (Expected: 401)`);

    // 2. GET Summary with invalid token
    console.log('2. Fetching summary with invalid token...');
    const resInvalidToken = await fetch(`http://localhost:5000/api/ai/summary/${testDocId}`, {
      headers: { 'Authorization': 'Bearer invalid-token-123' }
    });
    console.log(`- Response status: ${resInvalidToken.status} (Expected: 401)`);

    // 3. GET Summary with valid token (for non-existent document)
    console.log('3. Fetching summary with valid token (non-existent doc)...');
    const resValidToken = await fetch(`http://localhost:5000/api/ai/summary/${testDocId}`, {
      headers: { 'Authorization': 'Bearer test-token-uid-123' }
    });
    console.log(`- Response status: ${resValidToken.status} (Expected: 404)`);

    // 4. Test Reprocessing using an existing PNG document
    const lastDoc = await OriginalDocument.findOne({ userId: 'test-token-uid-123', mimeType: 'image/png' });
    if (lastDoc) {
      const activeDocId = lastDoc.documentId;
      console.log(`4. Running POST reprocess on existing Document ID: ${activeDocId}...`);
      
      const reprocessRes = await fetch(`http://localhost:5000/api/ai/reprocess/${activeDocId}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token-uid-123' }
      });
      const reprocessData = await reprocessRes.json();
      console.log(`- Reprocess Status: ${reprocessRes.status} (Expected: 200)`);
      console.log(`- Reprocess Message: "${reprocessData.message}"`);
      console.log(`- Reprocessed Summary ID: ${reprocessData.summaryId}`);
    } else {
      console.log('4. Skipping reprocess test (no active PNG document found in database).');
    }

  } catch (err) {
    console.error('Test 3 failed:', err);
  } finally {
    server.close(() => {
      console.log('\nTest server shut down.');
      mongoose.disconnect().then(() => {
        console.log('Disconnected from MongoDB.');
        console.log('\n=== Test 3 Completed ===');
        process.exit(0);
      });
    });
  }
}

testAuthSummary();
