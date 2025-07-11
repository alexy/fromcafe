#!/usr/bin/env node

/**
 * Test script to verify streaming upload works for large files
 * This simulates what Ulysses would send for a large image upload
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testLargeUpload() {
  console.log('🧪 Testing large file upload...');
  
  // Create a test file larger than 4.5MB
  const testFileName = 'test-large-image.jpg';
  const testFilePath = path.join(__dirname, testFileName);
  
  // Create a 6MB test file (filled with random data)
  const fileSize = 6 * 1024 * 1024; // 6MB
  const buffer = Buffer.alloc(fileSize);
  
  // Fill with some pattern to simulate an image
  for (let i = 0; i < fileSize; i++) {
    buffer[i] = i % 256;
  }
  
  fs.writeFileSync(testFilePath, buffer);
  console.log(`📁 Created test file: ${testFileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
  
  try {
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), {
      filename: testFileName,
      contentType: 'image/jpeg'
    });
    form.append('purpose', 'image');
    form.append('ref', testFileName);
    
    // Test the upload
    const response = await fetch('http://localhost:3000/api/ghost/admin/images/upload?domain=anthropology.from.cafe', {
      method: 'POST',
      body: form,
      headers: {
        'Authorization': 'Ghost your_test_token_here', // Replace with actual token
        ...form.getHeaders()
      }
    });
    
    const result = await response.json();
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Large file upload test PASSED');
    } else {
      console.log('❌ Large file upload test FAILED');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('🧹 Cleaned up test file');
    }
  }
}

if (require.main === module) {
  testLargeUpload();
}