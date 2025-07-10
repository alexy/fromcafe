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

async function compareGhostResponse() {
  try {
    // Fetch the same post that has images
    const response = await fetch(`${apiUrl}/ghost/api/admin/posts/684665d3bd9e010001032677?formats=html,lexical`, {
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
    const post = data.posts[0];
    
    console.log('=== REAL GHOST RESPONSE STRUCTURE ===');
    console.log('Response keys:', Object.keys(data));
    console.log('Post keys count:', Object.keys(post).length);
    console.log('Post keys:', Object.keys(post).sort());
    
    console.log('\n=== CRITICAL FIELDS ===');
    console.log('id:', post.id);
    console.log('uuid:', post.uuid);
    console.log('title:', post.title);
    console.log('slug:', post.slug);
    console.log('status:', post.status);
    console.log('visibility:', post.visibility);
    console.log('type:', post.type);
    
    console.log('\n=== CONTENT FIELDS ===');
    console.log('html length:', post.html?.length || 0);
    console.log('lexical length:', post.lexical?.length || 0);
    console.log('markdown:', post.markdown ? 'present' : 'null');
    console.log('mobiledoc:', post.mobiledoc ? 'present' : 'null');
    
    console.log('\n=== DATE FIELDS ===');
    console.log('created_at:', post.created_at);
    console.log('updated_at:', post.updated_at);
    console.log('published_at:', post.published_at);
    
    console.log('\n=== AUTHOR FIELDS ===');
    console.log('authors length:', post.authors?.length || 0);
    if (post.authors && post.authors[0]) {
      console.log('author keys:', Object.keys(post.authors[0]).sort());
      console.log('author roles length:', post.authors[0].roles?.length || 0);
    }
    
    console.log('\n=== RESPONSE HEADERS ===');
    console.log('Headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    
    // Show full response structure (truncated)
    console.log('\n=== FULL POST STRUCTURE (truncated) ===');
    const truncatedPost = { ...post };
    if (truncatedPost.html) truncatedPost.html = `${truncatedPost.html.substring(0, 100)}...`;
    if (truncatedPost.lexical) truncatedPost.lexical = `${truncatedPost.lexical.substring(0, 100)}...`;
    console.log(JSON.stringify(truncatedPost, null, 2));

  } catch (error) {
    console.error('Fetch error:', error);
  }
}

compareGhostResponse();