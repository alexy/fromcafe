const jwt = require('jsonwebtoken');

async function compareHeaders() {
  console.log('=== COMPARING RESPONSE HEADERS ===\n');

  // Real Ghost
  const realToken = jwt.sign({}, Buffer.from('c7b414d765305cb58c2f10fa62c22185973e555d06f952e037793c1a808cfa12', 'hex'), {
    keyid: '662f3d83759f930001ea61b9',
    algorithm: 'HS256',
    expiresIn: '5m',
    audience: '/admin/'
  });

  // Our API
  const ourToken = jwt.sign({}, Buffer.from('74db7da8e3d24c07b01c9b97c7f4a3c8e5afc30a7b8095cd8a42c52ad5b67e51', 'hex'), {
    keyid: '68698050f98c42d188f4cdf5',
    algorithm: 'HS256',
    expiresIn: '5m',
    audience: ['/v3/admin/', '/v4/admin/', '/v5/admin/']
  });

  try {
    console.log('1. Checking REAL GHOST headers...');
    const realResponse = await fetch('https://www.is.photography/ghost/api/admin/site/', {
      headers: {
        'Authorization': `Ghost ${realToken}`,
        'Accept-Version': 'v5.0',
        'Content-Type': 'application/json'
      }
    });

    console.log('Real Ghost headers:');
    for (const [key, value] of realResponse.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    console.log('\n2. Checking OUR API headers...');
    const ourResponse = await fetch('https://anthropology.from.cafe/ghost/api/v4/admin/site/', {
      headers: {
        'Authorization': `Ghost ${ourToken}`,
        'Accept-Version': 'v5.0',
        'Content-Type': 'application/json'
      }
    });

    console.log('Our API headers:');
    for (const [key, value] of ourResponse.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    // Find differences
    console.log('\n=== HEADER DIFFERENCES ===');
    const realHeaders = new Map(realResponse.headers.entries());
    const ourHeaders = new Map(ourResponse.headers.entries());

    // Headers in real Ghost but not in ours
    console.log('\nMissing in our API:');
    for (const [key, value] of realHeaders) {
      if (!ourHeaders.has(key)) {
        console.log(`  ❌ ${key}: ${value}`);
      }
    }

    // Headers in ours but not in real Ghost
    console.log('\nExtra in our API:');
    for (const [key, value] of ourHeaders) {
      if (!realHeaders.has(key)) {
        console.log(`  ➕ ${key}: ${value}`);
      }
    }

    // Different values
    console.log('\nDifferent values:');
    for (const [key, realValue] of realHeaders) {
      const ourValue = ourHeaders.get(key);
      if (ourValue && ourValue !== realValue) {
        console.log(`  ⚠️  ${key}:`);
        console.log(`     Real: ${realValue}`);
        console.log(`     Ours: ${ourValue}`);
      }
    }

  } catch (error) {
    console.error('Error comparing headers:', error);
  }
}

compareHeaders();