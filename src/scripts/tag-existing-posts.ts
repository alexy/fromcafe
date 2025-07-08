/**
 * One-time script to tag existing posts that don't have tags yet
 * Run this after adding the tagging system to retroactively tag existing posts
 */

import { prisma } from '@/lib/prisma'
import { tagPostBySource } from '@/lib/blog/tags'
import { ContentSource } from '@prisma/client'

async function tagExistingPosts() {
  console.log('🏷️  Starting to tag existing posts...')
  
  // Find all posts that don't have any tags
  const postsWithoutTags = await prisma.post.findMany({
    where: {
      postTags: {
        none: {}
      }
    },
    include: {
      blog: true,
      postTags: {
        include: {
          tag: true
        }
      }
    }
  })
  
  console.log(`📊 Found ${postsWithoutTags.length} posts without tags`)
  
  let evernoteCount = 0
  let ghostCount = 0
  let errorCount = 0
  
  for (const post of postsWithoutTags) {
    try {
      // Determine content source based on contentSource field
      const contentSource = post.contentSource || ContentSource.EVERNOTE // Default to Evernote for legacy posts
      
      // Tag the post
      await tagPostBySource(post.id, contentSource)
      
      if (contentSource === ContentSource.EVERNOTE) {
        evernoteCount++
      } else {
        ghostCount++
      }
      
      console.log(`✅ Tagged "${post.title}" (${post.blog.title}) as ${contentSource.toLowerCase()}`)
      
    } catch (error) {
      console.error(`❌ Error tagging post "${post.title}":`, error)
      errorCount++
    }
  }
  
  console.log('\n📈 Tagging Summary:')
  console.log(`   🌿 Evernote posts tagged: ${evernoteCount}`)
  console.log(`   👻 Ghost posts tagged: ${ghostCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  console.log(`   📝 Total posts tagged: ${evernoteCount + ghostCount}`)
  console.log('🎉 Tagging complete!')
}

// Run the script
tagExistingPosts()
  .catch(console.error)
  .finally(() => process.exit(0))