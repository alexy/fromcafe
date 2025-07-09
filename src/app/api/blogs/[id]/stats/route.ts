import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify user owns this blog
    const blog = await prisma.blog.findUnique({
      where: { id },
      select: { userId: true }
    })

    if (!blog || blog.userId !== session.user.id) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Get detailed post statistics
    const stats = await prisma.post.aggregate({
      where: { blogId: id },
      _count: {
        id: true
      }
    })

    const publishedStats = await prisma.post.aggregate({
      where: { 
        blogId: id,
        isPublished: true
      },
      _count: {
        id: true
      }
    })

    const unpublishedStats = await prisma.post.aggregate({
      where: { 
        blogId: id,
        isPublished: false
      },
      _count: {
        id: true
      }
    })

    const evernoteStats = await prisma.post.aggregate({
      where: { 
        blogId: id,
        contentSource: 'EVERNOTE'
      },
      _count: {
        id: true
      }
    })

    const ghostStats = await prisma.post.aggregate({
      where: { 
        blogId: id,
        contentSource: 'GHOST'
      },
      _count: {
        id: true
      }
    })

    const publishedEvernoteStats = await prisma.post.aggregate({
      where: { 
        blogId: id,
        contentSource: 'EVERNOTE',
        isPublished: true
      },
      _count: {
        id: true
      }
    })

    const publishedGhostStats = await prisma.post.aggregate({
      where: { 
        blogId: id,
        contentSource: 'GHOST',
        isPublished: true
      },
      _count: {
        id: true
      }
    })

    return NextResponse.json({
      totalCount: stats._count.id,
      published: publishedStats._count.id,
      unpublished: unpublishedStats._count.id,
      evernoteCount: evernoteStats._count.id,
      ghostCount: ghostStats._count.id,
      publishedEvernoteCount: publishedEvernoteStats._count.id,
      publishedGhostCount: publishedGhostStats._count.id,
      unpublishedEvernoteCount: evernoteStats._count.id - publishedEvernoteStats._count.id,
      unpublishedGhostCount: ghostStats._count.id - publishedGhostStats._count.id
    })

  } catch (error) {
    console.error('Error fetching blog stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blog stats' },
      { status: 500 }
    )
  }
}