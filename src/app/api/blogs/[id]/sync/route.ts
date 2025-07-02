import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SyncService } from '@/lib/sync'
import { prisma } from '@/lib/prisma'
import { EvernoteService } from '@/lib/evernote'
import { rateLimiter } from '@/lib/rate-limiter'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const blogId = resolvedParams.id

    // Rate limit individual blog sync requests (minimum 10 seconds between syncs)
    const rateLimitKey = `sync-blog:${session.user.id}:${blogId}`
    if (!rateLimiter.canMakeRequest(rateLimitKey, 10000)) {
      const timeLeft = rateLimiter.getTimeUntilNextRequest(rateLimitKey, 10000)
      return NextResponse.json({ 
        success: false, 
        error: `Please wait ${Math.ceil(timeLeft / 1000)} seconds before syncing this blog again.` 
      }, { status: 429 })
    }

    // Get the blog and verify it belongs to the user
    const blog = await prisma.blog.findFirst({
      where: { 
        id: blogId,
        userId: session.user.id 
      },
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    if (!blog.evernoteNotebook) {
      return NextResponse.json({ error: 'Blog is not connected to an Evernote notebook' }, { status: 400 })
    }

    // Get user's Evernote credentials
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        evernoteToken: true,
        evernoteNoteStoreUrl: true 
      },
    })

    if (!user?.evernoteToken) {
      return NextResponse.json({ error: 'Evernote not connected' }, { status: 400 })
    }

    // Perform the sync for this specific blog
    const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl || undefined, session.user.id)
    const result = await SyncService.syncBlogPosts(blogId, blog.title, blog.evernoteNotebook, evernoteService)

    // Check if the sync result contains an error
    if (result.error) {
      // Handle rate limiting specifically
      if (result.error.includes('rate limit exceeded')) {
        return NextResponse.json({ 
          success: false, 
          error: result.error 
        }, { status: 429 })
      }
      
      // Handle other errors
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      result
    })
  } catch (error) {
    console.error('Blog sync error:', error)
    
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