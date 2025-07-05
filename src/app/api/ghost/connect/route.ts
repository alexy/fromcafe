import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { testGhostConnection } from '@/lib/ghost-sync'
import { validateGhostUrl } from '@/lib/ghost-api'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { ghostSiteUrl, ghostApiToken, blogId } = body

    if (!ghostSiteUrl || !ghostApiToken) {
      return NextResponse.json({ 
        error: 'Ghost site URL and API token are required' 
      }, { status: 400 })
    }

    // Validate URL format
    if (!validateGhostUrl(ghostSiteUrl)) {
      return NextResponse.json({ 
        error: 'Invalid Ghost site URL format' 
      }, { status: 400 })
    }

    // Test the connection
    const connectionTest = await testGhostConnection(ghostSiteUrl, ghostApiToken)
    
    if (!connectionTest.success) {
      return NextResponse.json({ 
        error: connectionTest.error || 'Failed to connect to Ghost API'
      }, { status: 400 })
    }

    if (blogId) {
      // Update specific blog with Ghost configuration
      const blog = await prisma.blog.findFirst({
        where: {
          id: blogId,
          userId: session.user.id
        }
      })

      if (!blog) {
        return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
      }

      const updatedBlog = await prisma.blog.update({
        where: { id: blogId },
        data: {
          ghostSiteUrl,
          ghostApiToken,
          contentSources: {
            set: blog.contentSources.includes('GHOST') 
              ? blog.contentSources 
              : [...blog.contentSources, 'GHOST']
          }
        }
      })

      return NextResponse.json({
        success: true,
        blog: updatedBlog,
        siteInfo: connectionTest.siteInfo
      })
    } else {
      // Update user with default Ghost configuration
      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ghostApiUrl: ghostSiteUrl,
          ghostApiToken
        }
      })

      return NextResponse.json({
        success: true,
        user: { id: updatedUser.id, ghostApiUrl: updatedUser.ghostApiUrl },
        siteInfo: connectionTest.siteInfo
      })
    }

  } catch (error) {
    console.error('Error connecting to Ghost:', error)
    return NextResponse.json({ 
      error: 'Failed to connect to Ghost API' 
    }, { status: 500 })
  }
}