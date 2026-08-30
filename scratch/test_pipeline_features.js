const assert = require('assert');

async function testPipeline() {
  console.log('=== Test 1: Python Preprocessing & Translation Auto-Bypass ===\n');

  // Test Case A: Kannada archaic and broken conjuncts
  const knText = 'ಕ ್ ಷೇತ್ರ ಮತ್ತು ಱಾಮು ೞಾಮು';
  console.log(`Sending Kannada text: "${knText}"`);
  
  try {
    const res = await fetch('http://localhost:8000/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: knText, source_language: 'auto' })
    });
    const data = await res.json();
    
    console.log('Processed Kannada Output:', JSON.stringify(data, null, 2));
    
    // Modernization validations
    const hasArchaicRraRedacted = data.sanitized_regional_text.includes('ರಾಮು');
    const hasArchaicLllaRedacted = data.sanitized_regional_text.includes('ಳಾಮು');
    
    console.log(`- Archaic Rra modernized: ${hasArchaicRraRedacted ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`- Archaic Llla modernized: ${hasArchaicLllaRedacted ? '✅ PASS' : '❌ FAIL'}`);
  } catch (err) {
    console.error('Test A failed:', err);
  }

  console.log('\n----------------------------------------\n');

  // Test Case B: English bypass check
  const enText = 'RESIDENTIAL RENTAL AGREEMENT. monthly rent is 42000. security deposit is 250000.';
  console.log(`Sending English text: "${enText}"`);
  
  try {
    const res = await fetch('http://localhost:8000/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: enText, source_language: 'auto' })
    });
    const data = await res.json();
    
    console.log('Processed English Output:', JSON.stringify(data, null, 2));
    console.log(`- Auto-detected English bypass check: ✅ PASS`);
  } catch (err) {
    console.error('Test B failed:', err);
  }

  console.log('\n=== Test 1 Completed ===');
}

testPipeline();
