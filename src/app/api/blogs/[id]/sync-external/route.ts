import { NextRequest, NextResponse } from 'next/server'
import { SyncService } from '@/lib/sync'
import { prisma } from '@/lib/prisma'
import { EvernoteService } from '@/lib/evernote'
import { rateLimiter } from '@/lib/rate-limiter'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const blogId = resolvedParams.id

    // Get password from query params or Authorization header
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password') || request.headers.get('x-sync-password')
    
    if (!password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Password required. Use ?password=... or X-Sync-Password header' 
      }, { status: 401 })
    }

    // Get the blog and verify sync endpoint is enabled
    const blog = await prisma.blog.findUnique({
      where: { id: blogId },
      include: {
        user: {
          select: {
            id: true,
            evernoteToken: true,
            evernoteNoteStoreUrl: true
          }
        }
      }
    })

    if (!blog) {
      return NextResponse.json({ 
        success: false, 
        error: 'Blog not found' 
      }, { status: 404 })
    }

    // Check if sync endpoint is enabled
    const blogWithSyncFields = blog as typeof blog & { enableSyncEndpoint?: boolean; syncEndpointPassword?: string }
    if (!blogWithSyncFields.enableSyncEndpoint) {
      return NextResponse.json({ 
        success: false, 
        error: 'Sync endpoint not enabled for this blog' 
      }, { status: 403 })
    }

    // Verify password
    if (blogWithSyncFields.syncEndpointPassword !== password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid password' 
      }, { status: 401 })
    }

    // Check if blog has Evernote connection
    if (!blog.evernoteNotebook) {
      return NextResponse.json({ 
        success: false, 
        error: 'Blog is not connected to an Evernote notebook' 
      }, { status: 400 })
    }

    if (!blog.user.evernoteToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'User Evernote not connected' 
      }, { status: 400 })
    }

    // Rate limit external sync requests (minimum 30 seconds between syncs)
    const rateLimitKey = `sync-external:${blogId}`
    if (!rateLimiter.canMakeRequest(rateLimitKey, 30000)) {
      const timeLeft = rateLimiter.getTimeUntilNextRequest(rateLimitKey, 30000)
      return NextResponse.json({ 
        success: false, 
        error: `Rate limited. Please wait ${Math.ceil(timeLeft / 1000)} seconds before syncing again.` 
      }, { status: 429 })
    }

    // Perform the sync
    const evernoteService = new EvernoteService(
      blog.user.evernoteToken, 
      blog.user.evernoteNoteStoreUrl || undefined, 
      blog.user.id
    )
    
    const result = await SyncService.syncBlogPosts(
      blogId, 
      blog.title, 
      blog.evernoteNotebook, 
      evernoteService
    )

    // Check if the sync result contains an error
    if (result.error) {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      result: {
        synced: result.newPosts || 0,
        updated: result.updatedPosts || 0,
        deleted: result.unpublishedPosts || 0,
        blogTitle: blog.title,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('External sync error:', error)
    
    // Handle rate limiting specifically
    if (error instanceof Error && error.message.includes('rate limit exceeded')) {
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 429 })
    }
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Sync failed' 
    }, { status: 500 })
  }
}

// Also support GET method for simple URL-based triggering
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(request, { params })
}