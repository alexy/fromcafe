const jwt = require('jsonwebtoken');

// Real Ghost API credentials
const realGhostUrl = 'https://www.is.photography';
const realKeyId = '662f3d83759f930001ea61b9';
const realSecret = 'c7b414d765305cb58c2f10fa62c22185973e555d06f952e037793c1a808cfa12';

// Our Ghost API credentials  
const ourUrl = 'https://anthropology.from.cafe';
const ourKeyId = '68698050f98c42d188f4cdf5';
const ourSecret = '74db7da8e3d24c07b01c9b97c7f4a3c8e5afc30a7b8095cd8a42c52ad5b67e51';

async function compareResponses() {
  try {
    // Create tokens
    const realToken = jwt.sign({}, Buffer.from(realSecret, 'hex'), {
      keyid: realKeyId,
      algorithm: 'HS256',
      expiresIn: '5m',
      audience: '/admin/'
    });

    const ourToken = jwt.sign({}, Buffer.from(ourSecret, 'hex'), {
      keyid: ourKeyId,
      algorithm: 'HS256',
      expiresIn: '5m',
      audience: ['/v3/admin/', '/v4/admin/', '/v5/admin/']
    });

    console.log('=== COMPARING RESPONSE FORMATS ===\n');

    // Fetch from real Ghost - text post with image
    console.log('1. Fetching from REAL GHOST (post with image)...');
    const realResponse = await fetch(`${realGhostUrl}/ghost/api/admin/posts/684665d3bd9e010001032677?formats=html,lexical`, {
      headers: {
        'Authorization': `Ghost ${realToken}`,
        'Accept-Version': 'v5.0',
        'Content-Type': 'application/json'
      }
    });

    let realPost = null;
    if (realResponse.ok) {
      const realData = await realResponse.json();
      realPost = realData.posts[0];
      console.log('✅ Real Ghost response received');
    } else {
      console.log('❌ Real Ghost failed:', realResponse.status);
    }

    // Fetch from our API - text post
    console.log('\n2. Fetching from OUR API (text post)...');
    const ourResponse = await fetch(`${ourUrl}/ghost/api/v4/admin/posts/ec37ec1937885941495e57f5`, {
      headers: {
        'Authorization': `Ghost ${ourToken}`,
        'Accept-Version': 'v5.0', 
        'Content-Type': 'application/json'
      }
    });

    let ourPost = null;
    if (ourResponse.ok) {
      const ourData = await ourResponse.json();
      ourPost = ourData.posts[0];
      console.log('✅ Our API response received');
    } else {
      console.log('❌ Our API failed:', ourResponse.status);
      const error = await ourResponse.text();
      console.log('Error:', error);
    }

    if (!realPost || !ourPost) {
      console.log('Cannot compare - one or both requests failed');
      return;
    }

    // Compare field structures
    console.log('\n=== FIELD COMPARISON ===');
    const realFields = new Set(Object.keys(realPost));
    const ourFields = new Set(Object.keys(ourPost));
    
    console.log('Real Ghost field count:', realFields.size);
    console.log('Our API field count:', ourFields.size);
    
    // Fields in real Ghost but not in ours
    const missingInOurs = [...realFields].filter(f => !ourFields.has(f));
    if (missingInOurs.length > 0) {
      console.log('\n❌ Fields MISSING in our API:');
      missingInOurs.forEach(field => {
        console.log(`  - ${field}: ${JSON.stringify(realPost[field])}`);
      });
    }
    
    // Fields in ours but not in real Ghost
    const extraInOurs = [...ourFields].filter(f => !realFields.has(f));
    if (extraInOurs.length > 0) {
      console.log('\n❌ EXTRA fields in our API:');
      extraInOurs.forEach(field => {
        console.log(`  - ${field}: ${JSON.stringify(ourPost[field])}`);
      });
    }
    
    // Fields with different values
    console.log('\n=== VALUE DIFFERENCES ===');
    const commonFields = [...realFields].filter(f => ourFields.has(f));
    for (const field of commonFields) {
      const realValue = realPost[field];
      const ourValue = ourPost[field];
      
      // Skip fields that are expected to be different
      if (['id', 'uuid', 'title', 'slug', 'url', 'created_at', 'updated_at', 'html', 'lexical', 'authors', 'primary_author'].includes(field)) {
        continue;
      }
      
      if (JSON.stringify(realValue) !== JSON.stringify(ourValue)) {
        console.log(`⚠️  ${field}:`);
        console.log(`    Real: ${JSON.stringify(realValue)}`);
        console.log(`    Ours: ${JSON.stringify(ourValue)}`);
      }
    }
    
    // Check critical fields for Ulysses validation
    console.log('\n=== CRITICAL FIELDS FOR ULYSSES ===');
    const criticalFields = ['mobiledoc', 'markdown', 'email_only', 'email_segment', 'status', 'visibility'];
    criticalFields.forEach(field => {
      console.log(`${field}:`);
      console.log(`  Real: ${JSON.stringify(realPost[field])}`);
      console.log(`  Ours: ${JSON.stringify(ourPost[field])}`);
    });

  } catch (error) {
    console.error('Error comparing responses:', error);
  }
}

compareResponses();