/**
 * Ghost API Test Script
 * 
 * This script demonstrates how to publish posts to your blog using the Ghost Admin API.
 * 
 * Usage:
 * 1. Get a token from your blog settings -> Ghost Integration
 * 2. Replace the API_TOKEN and API_ENDPOINT below
 * 3. Run: node ghost-api-test.js
 */

const API_ENDPOINT = 'http://localhost:3001/api/ghost/admin/posts'
const API_TOKEN = 'YOUR_TOKEN_HERE' // Get this from your blog settings

async function createGhostPost(postData) {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${API_TOKEN}`,
        'Accept-Version': 'v5.0'
      },
      body: JSON.stringify({
        posts: [postData]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`API Error: ${JSON.stringify(error)}`)
    }

    const result = await response.json()
    console.log('✅ Post created successfully!')
    console.log('Post URL:', result.posts[0].url)
    console.log('Post ID:', result.posts[0].id)
    return result.posts[0]

  } catch (error) {
    console.error('❌ Error creating post:', error.message)
    throw error
  }
}

async function main() {
  console.log('🚀 Testing Ghost API...')

  if (API_TOKEN === 'YOUR_TOKEN_HERE') {
    console.log('❌ Please set your API token in the script first!')
    console.log('Get a token from: Blog Settings → Ghost Integration → Generate Token')
    return
  }

  // Example 1: Simple HTML post
  const htmlPost = {
    title: 'My First Ghost API Post',
    html: '<h1>Hello World!</h1><p>This post was created using the Ghost Admin API.</p><p>Pretty cool, right?</p>',
    status: 'published',
    excerpt: 'A test post created via the Ghost Admin API'
  }

  // Example 2: Markdown-style post
  const markdownPost = {
    title: 'Advanced Ghost API Example',
    html: `
      <h2>Welcome to Ghost API</h2>
      <p>This post demonstrates advanced features:</p>
      <ul>
        <li>HTML content</li>
        <li>Custom excerpts</li>
        <li>Published status</li>
        <li>Automatic slug generation</li>
      </ul>
      <blockquote>
        <p>The Ghost Admin API makes it easy to publish content programmatically!</p>
      </blockquote>
      <p>You can include <strong>bold text</strong>, <em>italic text</em>, and even code:</p>
      <pre><code>console.log('Hello from Ghost API!');</code></pre>
    `,
    excerpt: 'Learn about the advanced features of the Ghost Admin API integration.',
    status: 'published'
  }

  try {
    // Create the posts
    console.log('\n📝 Creating HTML post...')
    await createGhostPost(htmlPost)

    console.log('\n📝 Creating advanced post...')
    await createGhostPost(markdownPost)

    console.log('\n🎉 All posts created successfully!')
    console.log('Check your blog to see the new posts.')

  } catch (error) {
    console.error('\n💥 Test failed:', error.message)
  }
}

// Run the test
main().catch(console.error)