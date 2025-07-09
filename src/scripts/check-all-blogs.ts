/**
 * Script to check all blogs in the system and understand the current state
 */

import { prisma } from '@/lib/prisma'

async function checkAllBlogs() {
  console.log('🔍 Checking all blogs in the system...')
  
  try {
    // Get all blogs with their domains and post counts
    const blogs = await prisma.blog.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        domain: true,
        posts: {
          select: {
            id: true,
            title: true,
            slug: true,
            isPublished: true,
            publishedAt: true
          }
        },
        _count: {
          select: {
            posts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    console.log(`📊 Found ${blogs.length} blogs in the system`)
    
    for (const blog of blogs) {
      console.log(`\n📝 Blog: "${blog.title}" (${blog.slug})`)
      console.log(`   👤 Owner: ${blog.user.name} (${blog.user.email})`)
      console.log(`   📷 Show Camera Make: ${blog.showCameraMake}`)
      console.log(`   🎨 Theme: ${blog.theme}`)
      console.log(`   🌍 Public: ${blog.isPublic}`)
      console.log(`   🔄 Last Synced: ${blog.lastSyncedAt || 'Never'}`)
      console.log(`   📚 Total Posts: ${blog._count.posts}`)
      
      if (blog.domain) {
        console.log(`   🌐 Custom Domain: ${blog.domain.domain} (verified: ${blog.domain.isVerified})`)
      }
      
      if (blog.customDomain) {
        console.log(`   🌐 Custom Domain Field: ${blog.customDomain}`)
      }
      
      if (blog.subdomain) {
        console.log(`   🏠 Subdomain: ${blog.subdomain}`)
      }
      
      // Show published posts
      const publishedPosts = blog.posts.filter(post => post.isPublished)
      console.log(`   📄 Published Posts: ${publishedPosts.length}`)
      
      if (publishedPosts.length > 0) {
        publishedPosts.slice(0, 5).forEach(post => {
          console.log(`     - "${post.title}" (${post.slug}) - ${post.publishedAt}`)
        })
        
        if (publishedPosts.length > 5) {
          console.log(`     ... and ${publishedPosts.length - 5} more`)
        }
      }
    }
    
    // Check if there are any domains that might map to anthropology.from.cafe
    console.log('\n🔍 Checking domain mappings...')
    
    const domains = await prisma.domain.findMany({
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
    
    console.log(`📊 Found ${domains.length} domain mappings`)
    
    for (const domain of domains) {
      console.log(`   🌐 ${domain.domain} -> ${domain.blog ? `${domain.blog.title} (${domain.blog.slug})` : 'No blog'} (verified: ${domain.isVerified})`)
      if (domain.blog) {
        console.log(`     📷 ShowCameraMake: ${domain.blog.showCameraMake}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking blogs:', error)
  }
}

// Run the script
checkAllBlogs()
  .catch(console.error)
  .finally(() => process.exit(0))