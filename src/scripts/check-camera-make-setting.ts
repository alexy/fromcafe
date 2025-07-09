/**
 * Script to check the current showCameraMake setting for the 'anthropology' blog
 * and examine sample posts to understand the current state of image captions
 */

import { prisma } from '@/lib/prisma'

async function analyzePostContent(post: { title: string; slug: string; content: string; publishedAt: Date | null; updatedAt: Date }, isDetailed: boolean = false) {
  console.log(`\n📄 Post: "${post.title}"`)
  console.log(`   🔗 Slug: ${post.slug}`)
  console.log(`   📅 Published: ${post.publishedAt}`)
  console.log(`   🔄 Updated: ${post.updatedAt}`)
  
  // Check if the post content contains image captions with camera make info
  const content = post.content
  const imageMatches = content.match(/<img[^>]*>/g) || []
  const figureMatches = content.match(/<figure[^>]*>[\s\S]*?<\/figure>/g) || []
  const captionMatches = content.match(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/g) || []
  
  console.log(`   🖼️  Images found: ${imageMatches.length}`)
  console.log(`   🎯 Figures found: ${figureMatches.length}`)
  console.log(`   💬 Captions found: ${captionMatches.length}`)
  
  // Look for camera make information in captions
  if (captionMatches.length > 0) {
    console.log(`   📷 Caption analysis:`)
    captionMatches.forEach((caption, index) => {
      // Strip HTML tags for analysis
      const textContent = caption.replace(/<[^>]*>/g, '')
      
      // Look for camera make patterns (common camera brands)
      const cameraMakes = ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'Leica', 'Olympus', 'Panasonic', 'Pentax', 'Hasselblad', 'Mamiya']
      const foundMakes = cameraMakes.filter(make => textContent.includes(make))
      
      console.log(`     ${index + 1}. "${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}"`)
      if (foundMakes.length > 0) {
        console.log(`        🎯 Camera makes detected: ${foundMakes.join(', ')}`)
      }
      
      if (isDetailed) {
        console.log(`        📋 HTML: ${caption}`)
        console.log(`        📝 Text: ${textContent}`)
      }
    })
  }
  
  // If this is detailed analysis, also show some sample figures
  if (isDetailed && figureMatches.length > 0) {
    console.log(`   🎯 Figure analysis (first 3):`)
    figureMatches.slice(0, 3).forEach((figure, index) => {
      console.log(`     Figure ${index + 1}:`)
      console.log(`     ${figure.substring(0, 300)}${figure.length > 300 ? '...' : ''}`)
      console.log('')
    })
  }
}

async function checkCameraMakeSetting() {
  console.log('🔍 Checking showCameraMake setting for anthropology blog...')
  
  try {
    // Find the blog with slug 'anthropology'
    const blog = await prisma.blog.findFirst({
      where: {
        slug: 'anthropology'
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })
    
    if (!blog) {
      console.log('❌ Blog with slug "anthropology" not found')
      return
    }
    
    console.log('\n📊 Blog Information:')
    console.log(`   📝 Title: ${blog.title}`)
    console.log(`   🔗 Slug: ${blog.slug}`)
    console.log(`   👤 Owner: ${blog.user.name} (${blog.user.email})`)
    console.log(`   📷 Show Camera Make: ${blog.showCameraMake}`)
    console.log(`   🎨 Theme: ${blog.theme}`)
    console.log(`   🌍 Public: ${blog.isPublic}`)
    console.log(`   🔄 Last Synced: ${blog.lastSyncedAt || 'Never'}`)
    
    // Now let's look for the specific post mentioned in the URL
    console.log('\n🔍 Looking for the specific post "road-trip-june-25"...')
    
    const specificPost = await prisma.post.findFirst({
      where: {
        blogId: blog.id,
        slug: 'road-trip-june-25'
      },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
        isPublished: true
      }
    })
    
    if (specificPost) {
      console.log('✅ Found the specific post!')
      console.log(`   📝 Title: ${specificPost.title}`)
      console.log(`   🔗 Slug: ${specificPost.slug}`)
      console.log(`   📅 Published: ${specificPost.publishedAt}`)
      console.log(`   🔄 Updated: ${specificPost.updatedAt}`)
      console.log(`   🌍 Is Published: ${specificPost.isPublished}`)
      
      // Analyze this specific post in detail
      await analyzePostContent(specificPost, true)
    } else {
      console.log('❌ Post "road-trip-june-25" not found in anthropology blog')
      
      // Let's search for this post across all blogs
      console.log('\n🔍 Searching for "road-trip-june-25" across all blogs...')
      
      const globalPost = await prisma.post.findFirst({
        where: {
          slug: 'road-trip-june-25'
        },
        include: {
          blog: {
            select: {
              title: true,
              slug: true,
              showCameraMake: true
            }
          }
        }
      })
      
      if (globalPost) {
        console.log('✅ Found the post in a different blog!')
        console.log(`   📝 Title: ${globalPost.title}`)
        console.log(`   🔗 Slug: ${globalPost.slug}`)
        console.log(`   📚 Blog: ${globalPost.blog.title} (${globalPost.blog.slug})`)
        console.log(`   📷 Blog's showCameraMake setting: ${globalPost.blog.showCameraMake}`)
        console.log(`   🌍 Is Published: ${globalPost.isPublished}`)
        console.log(`   📅 Published: ${globalPost.publishedAt}`)
        console.log(`   🔄 Updated: ${globalPost.updatedAt}`)
        
        await analyzePostContent(globalPost, true)
      } else {
        console.log('❌ Post "road-trip-june-25" not found anywhere')
        
        // Let's search for posts with similar slugs
        console.log('\n🔍 Searching for posts with "road-trip" in the slug...')
        
        const similarPosts = await prisma.post.findMany({
          where: {
            slug: {
              contains: 'road-trip'
            }
          },
          include: {
            blog: {
              select: {
                title: true,
                slug: true,
                showCameraMake: true
              }
            }
          },
          take: 5
        })
        
        if (similarPosts.length > 0) {
          console.log(`📋 Found ${similarPosts.length} posts with "road-trip" in the slug:`)
          similarPosts.forEach(post => {
            console.log(`   📝 "${post.title}" (${post.slug}) in blog "${post.blog.title}"`)
          })
        } else {
          console.log('❌ No posts with "road-trip" in the slug found')
        }
      }
    }
    
    // Now let's look at sample posts from this blog
    console.log('\n🔍 Looking for sample posts...')
    
    const samplePosts = await prisma.post.findMany({
      where: {
        blogId: blog.id,
        isPublished: true
      },
      orderBy: {
        publishedAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        publishedAt: true,
        updatedAt: true
      }
    })
    
    console.log(`📋 Found ${samplePosts.length} published posts`)
    
    for (const post of samplePosts) {
      await analyzePostContent(post, false)
    }
    
    // Also search for any posts with images or captions
    console.log('\n🔍 Looking for posts with images/captions...')
    
    const postsWithContent = await prisma.post.findMany({
      where: {
        blogId: blog.id,
        isPublished: true,
        content: {
          contains: '<img'
        }
      },
      orderBy: {
        publishedAt: 'desc'
      },
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        publishedAt: true,
        updatedAt: true
      }
    })
    
    console.log(`📋 Found ${postsWithContent.length} posts with images`)
    
    for (const post of postsWithContent) {
      await analyzePostContent(post, true)
    }
    
    // Also search for posts with images across all blogs to understand the data structure
    console.log('\n🔍 Looking for posts with images across all blogs...')
    
    const allPostsWithImages = await prisma.post.findMany({
      where: {
        isPublished: true,
        content: {
          contains: '<img'
        }
      },
      include: {
        blog: {
          select: {
            title: true,
            slug: true,
            showCameraMake: true
          }
        }
      },
      orderBy: {
        publishedAt: 'desc'
      },
      take: 3
    })
    
    console.log(`📋 Found ${allPostsWithImages.length} posts with images across all blogs`)
    
    for (const post of allPostsWithImages) {
      console.log(`\n📄 Post: "${post.title}" in blog "${post.blog.title}" (${post.blog.slug})`)
      console.log(`   🔗 Slug: ${post.slug}`)
      console.log(`   📷 Blog's showCameraMake setting: ${post.blog.showCameraMake}`)
      console.log(`   📅 Published: ${post.publishedAt}`)
      console.log(`   🔄 Updated: ${post.updatedAt}`)
      
      await analyzePostContent(post, true)
    }
    
  } catch (error) {
    console.error('❌ Error checking camera make setting:', error)
  }
}

// Run the script
checkCameraMakeSetting()
  .catch(console.error)
  .finally(() => process.exit(0))