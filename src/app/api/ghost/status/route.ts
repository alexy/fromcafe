import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { testGhostConnection } from '@/lib/ghost-sync'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const blogId = searchParams.get('blogId')

    if (blogId) {
      // Get Ghost status for specific blog
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

      const hasGhostEnabled = blog.contentSources.includes('GHOST')
      const ghostSiteUrl = blog.ghostSiteUrl || blog.user.ghostApiUrl
      const ghostApiToken = blog.ghostApiToken || blog.user.ghostApiToken

      let connectionStatus = null
      let siteInfo = null

      if (hasGhostEnabled && ghostSiteUrl && ghostApiToken) {
        const connectionTest = await testGhostConnection(ghostSiteUrl, ghostApiToken)
        connectionStatus = connectionTest.success
        siteInfo = connectionTest.siteInfo
      }

      return NextResponse.json({
        hasGhostEnabled,
        isConnected: !!(ghostSiteUrl && ghostApiToken),
        connectionStatus,
        ghostSiteUrl,
        lastSyncedAt: blog.ghostLastSyncedAt,
        lastSyncUpdateCount: blog.lastSyncUpdateCount,
        siteInfo
      })
    } else {
      // Get user's default Ghost status
      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const isConnected = !!(user.ghostApiUrl && user.ghostApiToken)
      let connectionStatus = null
      let siteInfo = null

      if (isConnected) {
        const connectionTest = await testGhostConnection(user.ghostApiUrl!, user.ghostApiToken!)
        connectionStatus = connectionTest.success
        siteInfo = connectionTest.siteInfo
      }

      return NextResponse.json({
        isConnected,
        connectionStatus,
        ghostSiteUrl: user.ghostApiUrl,
        siteInfo
      })
    }

  } catch (error) {
    console.error('Error getting Ghost status:', error)
    return NextResponse.json({ 
      error: 'Failed to get Ghost status' 
    }, { status: 500 })
  }
}