const jwt = require('jsonwebtoken');

// Ghost API credentials
const apiUrl = 'https://www.is.photography';
const keyId = '662f3d83759f930001ea61b9';
const secret = 'c7b414d765305cb58c2f10fa62c22185973e555d06f952e037793c1a808cfa12';

// Create JWT token
const token = jwt.sign({}, Buffer.from(secret, 'hex'), {
  keyid: keyId,
  algorithm: 'HS256',
  expiresIn: '5m',
  audience: '/admin/'
});

console.log('JWT Token:', token);

// Fetch posts
async function fetchGhostPosts() {
  try {
    const response = await fetch(`${apiUrl}/ghost/api/admin/posts/?formats=html,lexical&limit=5`, {
      headers: {
        'Authorization': `Ghost ${token}`,
        'Accept-Version': 'v5.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', response.status, error);
      return;
    }

    const data = await response.json();
    console.log('Posts found:', data.posts.length);
    
    // Look for posts with images
    for (const post of data.posts) {
      console.log('\n=== POST:', post.title, '===');
      console.log('ID:', post.id);
      console.log('Has images in HTML:', post.html?.includes('<img') || false);
      console.log('Has lexical:', !!post.lexical);
      console.log('Lexical length:', post.lexical?.length || 0);
      
      if (post.lexical && post.html?.includes('<img')) {
        console.log('\n--- LEXICAL FORMAT FOR POST WITH IMAGES ---');
        try {
          const lexicalObj = JSON.parse(post.lexical);
          console.log('Lexical structure:');
          console.log(JSON.stringify(lexicalObj, null, 2));
          
          // Look for image nodes
          const findImageNodes = (obj) => {
            if (Array.isArray(obj)) {
              obj.forEach(findImageNodes);
            } else if (typeof obj === 'object' && obj !== null) {
              if (obj.type && (obj.type.includes('image') || obj.type.includes('Image'))) {
                console.log('\n🖼️ FOUND IMAGE NODE:');
                console.log(JSON.stringify(obj, null, 2));
              }
              Object.values(obj).forEach(findImageNodes);
            }
          };
          
          findImageNodes(lexicalObj);
        } catch (e) {
          console.error('Failed to parse lexical JSON:', e);
        }
        break; // Stop after first post with images
      }
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

fetchGhostPosts();