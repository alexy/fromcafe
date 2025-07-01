import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Reset sync state for all blogs belonging to this user
    const result = await prisma.blog.updateMany({
      where: { 
        userId: session.user.id 
      },
      data: {
        lastSyncedAt: null,
        lastSyncAttemptAt: null,
        lastSyncUpdateCount: null
      }
    })

    console.log(`Reset sync state for ${result.count} blogs for user: ${session.user.id}`)
    
    return NextResponse.json({ 
      success: true,
      message: `Reset sync state for ${result.count} blogs. Next syncs will be fresh full syncs.`,
      blogsReset: result.count
    })
  } catch (error) {
    console.error('Error resetting all sync states:', error)
    return NextResponse.json({ 
      error: 'Failed to reset sync states' 
    }, { status: 500 })
  }
}