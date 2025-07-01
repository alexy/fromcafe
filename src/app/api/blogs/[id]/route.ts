import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const blog = await prisma.blog.findFirst({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    return NextResponse.json({ blog })
  } catch (error) {
    console.error('Error fetching blog:', error)
    return NextResponse.json({ error: 'Failed to fetch blog' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const body = await request.json()
    const { title, description, isPublic, evernoteNotebook } = body

    const blog = await prisma.blog.updateMany({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      data: {
        title,
        description,
        isPublic,
        evernoteNotebook,
      },
    })

    if (blog.count === 0) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Fetch the updated blog
    const updatedBlog = await prisma.blog.findFirst({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    })

    return NextResponse.json({ blog: updatedBlog })
  } catch (error) {
    console.error('Error updating blog:', error)
    return NextResponse.json({ error: 'Failed to update blog' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    
    // First check if the blog exists and belongs to the user
    const blog = await prisma.blog.findFirst({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Delete all posts associated with the blog first
    await prisma.post.deleteMany({
      where: { blogId: resolvedParams.id }
    })

    // Then delete the blog
    await prisma.blog.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({ message: 'Blog deleted successfully' })
  } catch (error) {
    console.error('Error deleting blog:', error)
    return NextResponse.json({ error: 'Failed to delete blog' }, { status: 500 })
  }
}