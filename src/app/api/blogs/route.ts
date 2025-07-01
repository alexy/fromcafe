import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const blogs = await prisma.blog.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        customDomain: true,
        evernoteNotebook: true,
        isPublic: true,
        lastSyncedAt: true,
        lastSyncAttemptAt: true,
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ blogs })
  } catch (error) {
    console.error('Error fetching blogs:', error)
    return NextResponse.json({ error: 'Failed to fetch blogs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, description, slug, evernoteNotebook, isPublic } = body

    // Check if slug already exists
    const existingBlog = await prisma.blog.findUnique({
      where: { slug },
    })

    if (existingBlog) {
      return NextResponse.json({ 
        error: `A blog with the URL slug "${slug}" already exists. Please choose a different slug.` 
      }, { status: 400 })
    }

    const blog = await prisma.blog.create({
      data: {
        userId: session.user.id,
        title,
        description,
        slug,
        evernoteNotebook,
        isPublic: isPublic !== undefined ? isPublic : true,
      },
    })

    return NextResponse.json({ blog })
  } catch (error) {
    console.error('Error creating blog:', error)
    
    // Handle Prisma unique constraint errors specifically
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const meta = (error as any).meta
      if (meta?.target?.includes('slug')) {
        return NextResponse.json({ 
          error: 'A blog with this URL slug already exists. Please choose a different slug.' 
        }, { status: 400 })
      }
    }
    
    return NextResponse.json({ error: 'Failed to create blog' }, { status: 500 })
  }
}