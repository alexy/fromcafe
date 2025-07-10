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

async function checkRealGhostSite() {
  try {
    console.log('Checking real Ghost site endpoint...');
    const response = await fetch(`${apiUrl}/ghost/api/admin/site/`, {
      headers: {
        'Authorization': `Ghost ${token}`,
        'Accept-Version': 'v5.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('Trying without auth...');
      const noAuthResponse = await fetch(`${apiUrl}/ghost/api/admin/site/`);
      if (noAuthResponse.ok) {
        const data = await noAuthResponse.json();
        console.log('✅ Real Ghost site endpoint works WITHOUT auth');
        console.log('Site data keys:', Object.keys(data.site));
        console.log('Full site data:', JSON.stringify(data, null, 2));
      } else {
        console.log('❌ Both auth and no-auth failed');
      }
      return;
    }

    const data = await response.json();
    console.log('✅ Real Ghost site endpoint response:');
    console.log('Site data keys:', Object.keys(data.site));
    console.log('Version:', data.site.version);
    console.log('Full site data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRealGhostSite();