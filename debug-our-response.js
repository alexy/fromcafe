const jwt = require('jsonwebtoken');

// Create a test request to our API to see exactly what we return
async function debugOurResponse() {
  try {
    // Use the same auth that Ulysses uses
    const keyId = '68698050f98c42d188f4cdf5';
    const secret = '74db7da8e3d24c07b01c9b97c7f4a3c8e5afc30a7b8095cd8a42c52ad5b67e51'; // From the logs
    
    const token = jwt.sign({}, Buffer.from(secret, 'hex'), {
      keyid: keyId,
      algorithm: 'HS256',
      expiresIn: '5m',
      audience: ['/v3/admin/', '/v4/admin/', '/v5/admin/']
    });

    console.log('Fetching from our API...');
    const response = await fetch('https://anthropology.from.cafe/ghost/api/v4/admin/posts/ec37ec1937885941495e57f5', {
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
    
    console.log('=== OUR API RESPONSE ===');
    console.log('Response structure keys:', Object.keys(data));
    console.log('Post field count:', Object.keys(post).length);
    console.log('Post keys:', Object.keys(post).sort());
    
    console.log('\n=== CONTENT FIELDS ===');
    console.log('html present:', !!post.html);
    console.log('html length:', post.html?.length || 0);
    console.log('lexical present:', !!post.lexical);
    console.log('lexical length:', post.lexical?.length || 0);
    console.log('mobiledoc present:', !!post.mobiledoc);
    console.log('markdown present:', !!post.markdown);
    
    console.log('\n=== POTENTIALLY PROBLEMATIC FIELDS ===');
    console.log('type field:', post.type);
    console.log('email_only:', post.email_only);
    console.log('email_segment:', post.email_segment);
    console.log('plaintext:', post.plaintext);
    console.log('comment_id:', post.comment_id);
    console.log('email_recipient_filter:', post.email_recipient_filter);
    
    console.log('\n=== FULL POST STRUCTURE (first 200 chars per field) ===');
    for (const [key, value] of Object.entries(post)) {
      if (typeof value === 'string' && value.length > 200) {
        console.log(`${key}: "${value.substring(0, 200)}..."`);
      } else {
        console.log(`${key}:`, value);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugOurResponse();