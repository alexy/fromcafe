import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateBlogSlug, siteConfig } from '@/config/site'

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
        evernoteWebhookId: true,
        isPublic: true,
        lastSyncedAt: true,
        lastSyncAttemptAt: true,
        lastSyncUpdateCount: true,
        _count: {
          select: { 
            posts: {
              where: { isPublished: true }
            }
          },
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

    // Validate required fields
    if (!title || !slug) {
      return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 })
    }

    // Get user information for default author
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, displayName: true }
    })

    // Validate blog slug format and reserved words
    const slugValidation = validateBlogSlug(slug)
    if (!slugValidation.valid) {
      return NextResponse.json({ error: slugValidation.error }, { status: 400 })
    }

    // Check user's blog limit
    if (siteConfig.user.maxBlogs > 0) {
      const userBlogCount = await prisma.blog.count({
        where: { userId: session.user.id }
      })
      
      if (userBlogCount >= siteConfig.user.maxBlogs) {
        return NextResponse.json({ 
          error: `You have reached the maximum limit of ${siteConfig.user.maxBlogs} blogs` 
        }, { status: 400 })
      }
    }

    // Check if slug already exists for this user
    const existingBlog = await prisma.blog.findUnique({
      where: { 
        userId_slug: {
          userId: session.user.id,
          slug
        }
      },
    })

    if (existingBlog) {
      return NextResponse.json({ 
        error: `You already have a blog with the URL slug "${slug}". Please choose a different slug.` 
      }, { status: 400 })
    }

    const blog = await prisma.blog.create({
      data: {
        userId: session.user.id,
        title,
        description,
        slug,
        author: user?.displayName || user?.name || 'Anonymous',
        evernoteNotebook,
        isPublic: isPublic !== undefined ? isPublic : true,
      },
    })

    return NextResponse.json({ blog })
  } catch (error) {
    console.error('Error creating blog:', error)
    
    // Handle Prisma unique constraint errors specifically
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const meta = (error as { meta?: { target?: string[] } }).meta
      if (meta?.target?.includes('slug')) {
        return NextResponse.json({ 
          error: 'A blog with this URL slug already exists. Please choose a different slug.' 
        }, { status: 400 })
      }
    }
    
    return NextResponse.json({ error: 'Failed to create blog' }, { status: 500 })
  }
}