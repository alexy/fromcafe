import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tagPostBySource } from '@/lib/blog/tags'
import { ContentSource } from '@prisma/client'

async function checkAuth() {
  // Check if user is authenticated and has admin access
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return false
  }
  
  // Get user from database to check admin status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })
  
  return user?.role === 'ADMIN'
}

export async function GET() {
  try {
    if (!await checkAuth()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Checking posts without tags...')
    
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
    
    const summary = {
      totalFound: postsWithoutTags.length,
      evernoteCount: postsWithoutTags.filter(p => p.contentSource === ContentSource.EVERNOTE || !p.contentSource).length,
      ghostCount: postsWithoutTags.filter(p => p.contentSource === ContentSource.GHOST).length
    }
    
    const results = postsWithoutTags.map(post => ({
      id: post.id,
      title: post.title,
      blog: post.blog.title,
      source: (post.contentSource || ContentSource.EVERNOTE).toLowerCase(),
      status: 'untagged'
    }))
    
    return NextResponse.json({
      success: true,
      summary,
      results,
      verification: true
    })
    
  } catch (error) {
    console.error('Failed to verify tags:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    if (!await checkAuth()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const results = []
    
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
        
        results.push({
          id: post.id,
          title: post.title,
          blog: post.blog.title,
          source: contentSource.toLowerCase(),
          status: 'success'
        })
        
        console.log(`✅ Tagged "${post.title}" (${post.blog.title}) as ${contentSource.toLowerCase()}`)
        
      } catch (error) {
        console.error(`❌ Error tagging post "${post.title}":`, error)
        errorCount++
        results.push({
          id: post.id,
          title: post.title,
          blog: post.blog.title,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    const summary = {
      evernoteCount,
      ghostCount,
      errorCount,
      totalTagged: evernoteCount + ghostCount,
      totalFound: postsWithoutTags.length
    }
    
    console.log('\n📈 Tagging Summary:')
    console.log(`   🌿 Evernote posts tagged: ${evernoteCount}`)
    console.log(`   👻 Ghost posts tagged: ${ghostCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`   📝 Total posts tagged: ${evernoteCount + ghostCount}`)
    console.log('🎉 Tagging complete!')
    
    return NextResponse.json({
      success: true,
      summary,
      results
    })
    
  } catch (error) {
    console.error('Failed to tag existing posts:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}