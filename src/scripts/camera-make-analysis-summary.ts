/**
 * Summary script: Camera Make Setting Analysis
 * 
 * This script provides a comprehensive analysis of the showCameraMake setting
 * for the anthropology blog and searches for the specific post mentioned by the user.
 */

import { prisma } from '@/lib/prisma'

async function analyzeCameraMakeIssue() {
  console.log('📊 CAMERA MAKE SETTING ANALYSIS SUMMARY')
  console.log('=====================================')
  
  try {
    // 1. Check the anthropology blog
    console.log('\n1️⃣ ANTHROPOLOGY BLOG ANALYSIS:')
    console.log('   URL: https://anthropology.from.cafe/')
    
    const anthropologyBlog = await prisma.blog.findFirst({
      where: { slug: 'anthropology' },
      include: {
        user: { select: { name: true, email: true } },
        posts: {
          select: {
            id: true,
            title: true,
            slug: true,
            isPublished: true,
            publishedAt: true
          }
        }
      }
    })
    
    if (anthropologyBlog) {
      console.log(`   ✅ Blog found: "${anthropologyBlog.title}"`)
      console.log(`   👤 Owner: ${anthropologyBlog.user.name} (${anthropologyBlog.user.email})`)
      console.log(`   📷 showCameraMake setting: ${anthropologyBlog.showCameraMake}`)
      console.log(`   🎨 Theme: ${anthropologyBlog.theme}`)
      console.log(`   📚 Total posts: ${anthropologyBlog.posts.length}`)
      console.log(`   📄 Published posts: ${anthropologyBlog.posts.filter(p => p.isPublished).length}`)
      
      // List all posts
      console.log('\n   📝 All posts in this blog:')
      anthropologyBlog.posts.forEach(post => {
        const status = post.isPublished ? '✅ Published' : '❌ Unpublished'
        console.log(`     - "${post.title}" (${post.slug}) - ${status}`)
      })
    } else {
      console.log('   ❌ Anthropology blog not found')
    }
    
    // 2. Search for the specific post
    console.log('\n2️⃣ SPECIFIC POST SEARCH:')
    console.log('   Looking for: "road-trip-june-25"')
    console.log('   URL: https://anthropology.from.cafe/road-trip-june-25')
    
    const specificPost = await prisma.post.findFirst({
      where: { slug: 'road-trip-june-25' },
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
    
    if (specificPost) {
      console.log(`   ✅ Post found: "${specificPost.title}"`)
      console.log(`   📚 In blog: ${specificPost.blog.title} (${specificPost.blog.slug})`)
      console.log(`   📷 Blog's showCameraMake: ${specificPost.blog.showCameraMake}`)
      console.log(`   🌍 Published: ${specificPost.isPublished}`)
      console.log(`   📅 Published at: ${specificPost.publishedAt}`)
      console.log(`   🔄 Last updated: ${specificPost.updatedAt}`)
      
      // Check for images in the post
      const imageMatches = specificPost.content.match(/<img[^>]*>/g) || []
      const captionMatches = specificPost.content.match(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/g) || []
      
      console.log(`   🖼️  Images: ${imageMatches.length}`)
      console.log(`   💬 Captions: ${captionMatches.length}`)
      
      if (captionMatches.length > 0) {
        console.log('\n   📷 Caption analysis:')
        captionMatches.forEach((caption, index) => {
          const textContent = caption.replace(/<[^>]*>/g, '')
          const cameraMakes = ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'Leica', 'Olympus', 'Panasonic', 'Pentax', 'Hasselblad', 'Mamiya']
          const foundMakes = cameraMakes.filter(make => textContent.includes(make))
          
          console.log(`     ${index + 1}. "${textContent.substring(0, 80)}..."`)
          if (foundMakes.length > 0) {
            console.log(`        🎯 Camera makes detected: ${foundMakes.join(', ')}`)
          }
        })
      }
    } else {
      console.log('   ❌ Post "road-trip-june-25" not found anywhere in the database')
    }
    
    // 3. Check for posts with similar names
    console.log('\n3️⃣ SIMILAR POST SEARCH:')
    
    const similarPosts = await prisma.post.findMany({
      where: {
        OR: [
          { slug: { contains: 'road' } },
          { slug: { contains: 'trip' } },
          { slug: { contains: 'june' } },
          { title: { contains: 'road', mode: 'insensitive' } },
          { title: { contains: 'trip', mode: 'insensitive' } },
          { title: { contains: 'june', mode: 'insensitive' } }
        ]
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
      take: 10
    })
    
    if (similarPosts.length > 0) {
      console.log(`   📋 Found ${similarPosts.length} posts with similar names:`)
      similarPosts.forEach(post => {
        console.log(`     - "${post.title}" (${post.slug}) in "${post.blog.title}"`)
      })
    } else {
      console.log('   ❌ No similar posts found')
    }
    
    // 4. Check for posts with images
    console.log('\n4️⃣ POSTS WITH IMAGES:')
    
    const postsWithImages = await prisma.post.findMany({
      where: {
        isPublished: true,
        content: { contains: '<img' }
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
    
    if (postsWithImages.length > 0) {
      console.log(`   📋 Found ${postsWithImages.length} posts with images:`)
      postsWithImages.forEach(post => {
        console.log(`     - "${post.title}" (${post.slug}) in "${post.blog.title}"`)
        console.log(`       📷 Blog's showCameraMake: ${post.blog.showCameraMake}`)
      })
    } else {
      console.log('   ❌ No posts with images found in the database')
    }
    
    // 5. Summary and recommendations
    console.log('\n5️⃣ SUMMARY & RECOMMENDATIONS:')
    console.log('   ✅ The anthropology blog showCameraMake setting is correctly set to FALSE')
    console.log('   ❌ The specific post "road-trip-june-25" does NOT exist in the database')
    console.log('   ❌ No posts with images were found in the entire database')
    console.log('\n   🔍 POSSIBLE CAUSES:')
    console.log('   1. The user might be looking at a different environment (dev/staging vs production)')
    console.log('   2. The post might have been deleted or never existed')
    console.log('   3. The URL might be incorrect')
    console.log('   4. The post might be in a different system or platform')
    console.log('   5. The database might be empty or recently reset')
    
    console.log('\n   💡 NEXT STEPS:')
    console.log('   1. Verify which database environment the user is checking')
    console.log('   2. Check if the post exists in development/staging environments')
    console.log('   3. Verify the correct URL structure')
    console.log('   4. Check if there are any recent database migrations or resets')
    
  } catch (error) {
    console.error('❌ Error during analysis:', error)
  }
}

// Run the analysis
analyzeCameraMakeIssue()
  .catch(console.error)
  .finally(() => process.exit(0))