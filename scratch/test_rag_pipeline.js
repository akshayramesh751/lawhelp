module.paths.push('./server/node_modules');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Set env variables
process.env.NODE_ENV = 'test';
dotenv.config({ path: './server/.env' });

const express = require('express');
const connectDB = require('../server/utils/db');
const ragRoutes = require('../server/routes/ragRoutes');

async function testRagPipeline() {
  console.log('=== Test Phase 4: Hybrid RAG Retrieval Pipeline ===\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  app.use('/api/rag', ragRoutes);

  const server = app.listen(5000, async () => {
    console.log('Test server listening on port 5000.');

    try {
      // Query 1: Statutes exact matching (Central)
      console.log('\n--- Query 1: "What agreements are contracts?" (Central Statutes) ---');
      const res1 = await fetch('http://localhost:5000/api/rag/retrieve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token-uid-123'
        },
        body: JSON.stringify({
          query: 'What agreements are contracts?',
          country: 'India',
          domain: 'Contracts',
          limit: 2
        })
      });
      const data1 = await res1.json();
      console.log('Results:', JSON.stringify(data1, null, 2));

      // Query 2: State laws with metadata filtering (Karnataka, Employment)
      console.log('\n--- Query 2: "Notice period for dismissal in Karnataka" (State Laws) ---');
      const res2 = await fetch('http://localhost:5000/api/rag/retrieve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token-uid-123'
        },
        body: JSON.stringify({
          query: 'Notice period for dismissal',
          state: 'Karnataka',
          country: 'India',
          domain: 'Employment',
          limit: 2
        })
      });
      const data2 = await res2.json();
      console.log('Results:', JSON.stringify(data2, null, 2));

      // Query 3: Restraint of legal proceedings
      console.log('\n--- Query 3: "Agreements in restraint of legal proceedings" (Central Statutes) ---');
      const res3 = await fetch('http://localhost:5000/api/rag/retrieve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token-uid-123'
        },
        body: JSON.stringify({
          query: 'restraint of legal proceedings is void',
          country: 'India',
          domain: 'Contracts',
          limit: 2
        })
      });
      const data3 = await res3.json();
      console.log('Results:', JSON.stringify(data3, null, 2));

      console.log('\n=== All Phase 4 Retrieval Tests Completed ===');
    } catch (err) {
      console.error('Retrieval test failed:', err);
    } finally {
      server.close(() => {
        console.log('Test server shut down.');
        mongoose.disconnect().then(() => {
          console.log('Disconnected from MongoDB.');
          process.exit(0);
        });
      });
    }
  });
}

testRagPipeline();
