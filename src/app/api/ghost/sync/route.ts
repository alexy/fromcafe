import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncGhostPosts } from '@/lib/ghost-sync'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { blogId, forceFullSync = false } = body

    if (!blogId) {
      return NextResponse.json({ 
        error: 'Blog ID is required' 
      }, { status: 400 })
    }

    // Get the blog with Ghost configuration
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        userId: session.user.id
      },
      include: { user: true }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Check if Ghost is enabled for this blog
    if (!blog.contentSources.includes('GHOST')) {
      return NextResponse.json({ 
        error: 'Ghost is not enabled for this blog' 
      }, { status: 400 })
    }

    // Get Ghost configuration (blog-specific or user default)
    const ghostSiteUrl = blog.ghostSiteUrl || blog.user.ghostApiUrl
    const ghostApiToken = blog.ghostApiToken || blog.user.ghostApiToken

    if (!ghostSiteUrl || !ghostApiToken) {
      return NextResponse.json({ 
        error: 'Ghost API configuration not found. Please connect Ghost first.' 
      }, { status: 400 })
    }

    console.log(`Starting Ghost sync for blog ${blog.title} (${blog.id})`)

    // Perform the sync
    const syncResult = await syncGhostPosts({
      blogId,
      ghostSiteUrl,
      ghostApiToken,
      forceFullSync
    })

    if (syncResult.success) {
      console.log(`Ghost sync completed successfully for blog ${blog.title}`)
      return NextResponse.json({
        success: true,
        result: {
          newPosts: syncResult.newPosts,
          updatedPosts: syncResult.updatedPosts,
          lastSyncedAt: syncResult.lastSyncedAt,
          errors: syncResult.errors
        }
      })
    } else {
      console.error(`Ghost sync failed for blog ${blog.title}:`, syncResult.errors)
      return NextResponse.json({
        success: false,
        error: 'Sync completed with errors',
        result: {
          newPosts: syncResult.newPosts,
          updatedPosts: syncResult.updatedPosts,
          errors: syncResult.errors
        }
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error syncing Ghost posts:', error)
    return NextResponse.json({ 
      error: 'Failed to sync Ghost posts' 
    }, { status: 500 })
  }
}