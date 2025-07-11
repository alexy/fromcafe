#!/usr/bin/env node

// Test script to verify all Ghost API endpoints are working
// This helps debug the Ulysses compatibility issue

const endpoints = [
  '/ghost/api/v4/admin/site',
  '/ghost/api/v4/admin/config', 
  '/ghost/api/v4/admin/users/me',
  '/ghost/api/v4/admin/users/me/token',
  '/ghost/api/v4/admin/tags',
  '/ghost/api/v4/admin/posts'
];

async function testEndpoint(baseUrl, endpoint, token) {
  const url = `${baseUrl}${endpoint}`;
  
  console.log(`\n🔍 Testing: ${endpoint}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      console.log(`   ✅ SUCCESS`);
    } else {
      const error = await response.text();
      console.log(`   Error: ${error}`);
      console.log(`   ❌ FAILED`);
    }
  } catch (error) {
    console.log(`   Exception: ${error.message}`);
    console.log(`   ❌ FAILED`);
  }
}

async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const token = process.argv[3];
  
  if (!token) {
    console.error('Usage: node test-ghost-endpoints.js <baseUrl> <ghostToken>');
    console.error('Example: node test-ghost-endpoints.js http://localhost:3000 your-jwt-token');
    process.exit(1);
  }
  
  console.log(`🧪 Testing Ghost API endpoints on ${baseUrl}`);
  console.log(`🔑 Using token: ${token.substring(0, 20)}...`);
  
  for (const endpoint of endpoints) {
    await testEndpoint(baseUrl, endpoint, token);
  }
  
  console.log('\n🏁 Test completed');
}

main().catch(console.error);