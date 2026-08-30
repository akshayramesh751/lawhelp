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

async function testRelations() {
  console.log('=== Test 2: MongoDB Persistence & Relational Linkage ===\n');

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

  // Prepare mock file upload (using a 1x1 transparent PNG)
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const pngBuffer = Buffer.from(pngBase64, 'base64');
  const blob = new Blob([pngBuffer], { type: 'image/png' });
  const formData = new FormData();
  formData.append('documents', blob, 'rent_agreement.png');

  try {
    console.log('Sending file upload extract request...');
    const res = await fetch('http://localhost:5000/api/ai/extract', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token-uid-123'
      },
      body: formData
    });

    const data = await res.json();
    console.log('Upload response data:', JSON.stringify(data, null, 2));

    if (!res.ok) {
      throw new Error(data.message || 'Extract endpoint failed');
    }

    const docId = data.documentId;
    console.log(`\nVerifying records in MongoDB for Document ID: ${docId}`);

    const origDocs = await OriginalDocument.find({ documentId: docId });
    console.log(`- OriginalDocument pages created: ${origDocs.length} (Expected: 1)`);
    console.log(`- OriginalDocument status: ${origDocs[0]?.status} (Expected: processed)`);
    console.log(`- OriginalDocument userId: ${origDocs[0]?.userId} (Expected: test-token-uid-123)`);

    const summary = await DocumentSummary.findOne({ originalDocumentId: docId });
    console.log(`- DocumentSummary created: ${summary ? '✅ Yes' : '❌ No'}`);
    
    if (summary) {
      console.log(`- DocumentSummary userId: ${summary.userId} (Expected: test-token-uid-123)`);
      console.log(`- DocumentSummary page count: ${summary.metadata.pageCount}`);
      console.log(`- DocumentSummary PII redacted text: ${summary.textContent.redactedEnglishText.trim()}`);
      console.log(`- DocumentSummary Preamble: "${summary.structure.preamble.trim()}"`);
      console.log(`- DocumentSummary Parties Count: ${summary.structure.parties.length}`);
      console.log(`- DocumentSummary Clauses Count: ${summary.structure.clauses.length}`);
    }

  } catch (err) {
    console.error('Test 2 execution failed:', err);
  } finally {
    server.close(() => {
      console.log('\nTest server shut down.');
      mongoose.disconnect().then(() => {
        console.log('Disconnected from MongoDB.');
        console.log('\n=== Test 2 Completed ===');
        process.exit(0);
      });
    });
  }
}

testRelations();
