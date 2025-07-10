const jwt = require('jsonwebtoken');

const apiUrl = 'https://www.is.photography';
const keyId = '662f3d83759f930001ea61b9';
const secret = 'c7b414d765305cb58c2f10fa62c22185973e555d06f952e037793c1a808cfa12';

const token = jwt.sign({}, Buffer.from(secret, 'hex'), {
  keyid: keyId,
  algorithm: 'HS256',
  expiresIn: '5m',
  audience: '/admin/'
});

async function checkEndpoint(path, requiresAuth = true) {
  console.log(`\n=== Checking ${path} ===`);
  
  try {
    const headers = {
      'Accept-Version': 'v5.0',
      'Content-Type': 'application/json'
    };
    
    if (requiresAuth) {
      headers['Authorization'] = `Ghost ${token}`;
    }
    
    const response = await fetch(`${apiUrl}/ghost/api/admin${path}`, { headers });
    
    console.log(`Status: ${response.status}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Response keys:`, Object.keys(data));
      
      if (path === '/config/') {
        console.log('\n--- CONFIG DETAILS ---');
        const config = data.config;
        console.log('Version:', config.version);
        console.log('Environment:', config.environment);
        console.log('Database:', config.database);
        
        if (config.labs) {
          console.log('\nLabs features:');
          Object.entries(config.labs).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
        
        console.log('\nImage/Upload related:');
        console.log('imageOptimization:', config.imageOptimization);
        console.log('imageUpload:', config.imageUpload);
        console.log('fileStorage:', config.fileStorage);
        
        console.log('\nEditor:');
        console.log('editor:', config.editor);
        
        // Show all top-level config keys
        console.log('\nAll config keys:', Object.keys(config).sort());
      } else if (path === '/users/me/') {
        console.log('\n--- USER DETAILS ---');
        const user = data.users[0];
        console.log('User keys:', Object.keys(user).sort());
        console.log('Roles:', user.roles?.map(r => r.name));
      }
      
      // Show truncated response for reference
      console.log('\n--- TRUNCATED RESPONSE ---');
      const truncated = JSON.stringify(data, null, 2).substring(0, 1000);
      console.log(truncated + (truncated.length >= 1000 ? '...' : ''));
      
    } else {
      const error = await response.text();
      console.log(`Error: ${error}`);
      
      // Try without auth if it failed
      if (requiresAuth && response.status === 401) {
        console.log('\nTrying without authentication...');
        await checkEndpoint(path, false);
      }
    }
    
  } catch (error) {
    console.error(`Request failed:`, error.message);
  }
}

async function checkAllEndpoints() {
  console.log('Checking real Ghost endpoints...');
  
  // Check key endpoints that Ulysses might use for capability detection
  await checkEndpoint('/config/');
  await checkEndpoint('/site/');  
  await checkEndpoint('/users/me/');
  
  // Check if there are other capability-related endpoints
  console.log('\n=== Additional endpoint checks ===');
  await checkEndpoint('/settings/');
  await checkEndpoint('/images/');
  await checkEndpoint('/images/upload/');
}

checkAllEndpoints();