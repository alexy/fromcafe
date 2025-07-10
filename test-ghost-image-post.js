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

async function createTestImagePost() {
  try {
    // First, let's create a simple post with an image
    const postData = {
      posts: [{
        title: 'Test Image Post from Ulysses Compatibility Check',
        html: '<p>This is a test post with an image.</p><img src="https://digitalpress.fra1.cdn.digitaloceanspaces.com/rsknfpz/2025/06/Alexy_20230311_0006994.jpg" alt="Test image" /><p>End of post.</p>',
        status: 'draft'
      }]
    };

    console.log('Creating test post with image...');
    const response = await fetch(`${apiUrl}/ghost/api/admin/posts/`, {
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Accept-Version': 'v5.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('POST Error:', response.status, error);
      return;
    }

    const data = await response.json();
    const post = data.posts[0];
    console.log('✅ Post created successfully!');
    console.log('Post ID:', post.id);
    console.log('Post title:', post.title);
    console.log('Post status:', post.status);
    console.log('Post URL:', post.url);
    
    // Now let's fetch it back to see the exact format
    console.log('\n--- Fetching post back to see format ---');
    const getResponse = await fetch(`${apiUrl}/ghost/api/admin/posts/${post.id}?formats=html,lexical`, {
      headers: {
        'Authorization': `Ghost ${token}`,
        'Accept-Version': 'v5.0',
        'Content-Type': 'application/json'
      }
    });

    if (getResponse.ok) {
      const getData = await getResponse.json();
      const fetchedPost = getData.posts[0];
      
      console.log('\n=== FETCHED POST WITH IMAGE ===');
      console.log('HTML length:', fetchedPost.html?.length);
      console.log('Has images in HTML:', fetchedPost.html?.includes('<img'));
      console.log('Lexical length:', fetchedPost.lexical?.length);
      
      if (fetchedPost.lexical) {
        console.log('\n--- LEXICAL FORMAT FOR POST WITH IMAGES ---');
        try {
          const lexicalObj = JSON.parse(fetchedPost.lexical);
          console.log('Lexical structure:');
          console.log(JSON.stringify(lexicalObj, null, 2));
        } catch (e) {
          console.error('Failed to parse lexical JSON:', e);
        }
      }
      
      // Show key fields that might affect Ulysses validation
      console.log('\n=== KEY RESPONSE FIELDS ===');
      console.log('mobiledoc:', fetchedPost.mobiledoc);
      console.log('markdown:', fetchedPost.markdown);
      console.log('feature_image:', fetchedPost.feature_image);
      console.log('type field present:', 'type' in fetchedPost);
      console.log('email_only:', fetchedPost.email_only);
      console.log('newsletter:', fetchedPost.newsletter);
    }
    
  } catch (error) {
    console.error('Error creating test post:', error);
  }
}

createTestImagePost();