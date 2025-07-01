import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    
    // Verify the blog belongs to the user
    const blog = await prisma.blog.findFirst({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      select: { id: true, title: true }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Reset sync state to force a fresh sync
    await prisma.blog.update({
      where: { id: resolvedParams.id },
      data: {
        lastSyncedAt: null,
        lastSyncAttemptAt: null,
        lastSyncUpdateCount: null
      }
    })

    console.log(`Sync state reset for blog: ${blog.title}`)
    
    return NextResponse.json({ 
      success: true,
      message: 'Sync state reset successfully. Next sync will be a full sync.' 
    })
  } catch (error) {
    console.error('Error resetting sync state:', error)
    return NextResponse.json({ 
      error: 'Failed to reset sync state' 
    }, { status: 500 })
  }
}