import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { blogId } = body

    if (blogId) {
      // Remove Ghost configuration from specific blog
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
          ghostSiteUrl: null,
          ghostApiToken: null,
          ghostLastSyncedAt: null,
          contentSources: {
            set: blog.contentSources.filter(source => source !== 'GHOST')
          }
        }
      })

      return NextResponse.json({
        success: true,
        blog: updatedBlog
      })
    } else {
      // Remove Ghost configuration from user
      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ghostApiUrl: null,
          ghostApiToken: null
        }
      })

      return NextResponse.json({
        success: true,
        user: { id: updatedUser.id }
      })
    }

  } catch (error) {
    console.error('Error disconnecting Ghost:', error)
    return NextResponse.json({ 
      error: 'Failed to disconnect Ghost' 
    }, { status: 500 })
  }
}