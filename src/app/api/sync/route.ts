import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SyncService } from '@/lib/sync'
import { rateLimiter } from '@/lib/rate-limiter'

export async function POST() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Rate limit sync requests (minimum 30 seconds between syncs)
    const rateLimitKey = `sync:${session.user.id}`
    if (!rateLimiter.canMakeRequest(rateLimitKey, 30000)) {
      const timeLeft = rateLimiter.getTimeUntilNextRequest(rateLimitKey, 30000)
      return NextResponse.json({ 
        success: false, 
        results: [], 
        totalNewPosts: 0, 
        totalUpdatedPosts: 0, 
        error: `Please wait ${Math.ceil(timeLeft / 1000)} seconds before syncing again to avoid rate limits.` 
      }, { status: 429 })
    }

    const result = await SyncService.syncUserBlogs(session.user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Manual sync error:', error)
    
    // Handle rate limiting specifically
    if (error instanceof Error && error.message.includes('rate limit exceeded')) {
      return NextResponse.json({ 
        success: false, 
        results: [], 
        totalNewPosts: 0, 
        totalUpdatedPosts: 0, 
        error: error.message 
      }, { status: 429 })
    }
    
    return NextResponse.json({ 
      success: false, 
      results: [], 
      totalNewPosts: 0, 
      totalUpdatedPosts: 0, 
      error: error instanceof Error ? error.message : 'Sync failed' 
    }, { status: 500 })
  }
}