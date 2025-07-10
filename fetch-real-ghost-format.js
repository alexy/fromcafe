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

async function fetchPostWithAllFormats() {
  try {
    // Fetch the post we just created with all possible formats
    const postId = '686f5fdd67c8050001257ea0'; // From previous creation
    
    console.log('Fetching post with explicit formats...');
    const response = await fetch(`${apiUrl}/ghost/api/admin/posts/${postId}?formats=html,lexical,mobiledoc&include=authors,tags`, {
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
    
    console.log('=== COMPLETE REAL GHOST RESPONSE FOR POST WITH IMAGE ===');
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
    
    console.log('\n=== GHOST-SPECIFIC FIELDS ===');
    console.log('type field:', post.type);
    console.log('email_only:', post.email_only);
    console.log('newsletter:', post.newsletter);
    console.log('email_segment:', post.email_segment);
    console.log('frontmatter:', post.frontmatter);
    console.log('feature_image:', post.feature_image);
    console.log('email:', post.email);
    console.log('show_title_and_feature_image:', post.show_title_and_feature_image);
    
    if (post.html && post.html.includes('<img')) {
      console.log('\n=== HTML CONTENT WITH IMAGE ===');
      console.log(post.html);
    }
    
    if (post.lexical) {
      console.log('\n=== LEXICAL CONTENT ===');
      try {
        const lexicalObj = JSON.parse(post.lexical);
        console.log(JSON.stringify(lexicalObj, null, 2));
      } catch (e) {
        console.log('Raw lexical:', post.lexical);
      }
    }
    
    console.log('\n=== AUTHOR STRUCTURE ===');
    if (post.authors && post.authors[0]) {
      console.log('Author keys:', Object.keys(post.authors[0]).sort());
      console.log('Author roles structure:');
      if (post.authors[0].roles && post.authors[0].roles[0]) {
        console.log('Role keys:', Object.keys(post.authors[0].roles[0]).sort());
      }
    }
    
    // Compare critical fields with our implementation
    console.log('\n=== COMPARISON WITH OUR IMPLEMENTATION ===');
    console.log('Real Ghost has type field:', 'type' in post);
    console.log('Real Ghost mobiledoc:', post.mobiledoc);
    console.log('Real Ghost markdown:', post.markdown);
    console.log('Real Ghost email field:', post.email);
    console.log('Real Ghost newsletter field:', post.newsletter);
    
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

fetchPostWithAllFormats();