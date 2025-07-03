import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface TenantBlogsRouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: TenantBlogsRouteParams) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if user has access to this tenant
    const tenantUser = await prisma.tenantUser.findFirst({
      where: {
        tenantId: params.id,
        userId: session.user.id
      }
    })

    if (!tenantUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const blogs = await prisma.blog.findMany({
      where: {
        tenantId: params.id,
        userId: session.user.id
      },
      include: {
        _count: {
          select: {
            posts: true
          }
        },
        posts: {
          where: { isPublished: true },
          select: {
            id: true,
            title: true,
            publishedAt: true
          },
          orderBy: { publishedAt: 'desc' },
          take: 3
        }
      }
    })

    return NextResponse.json({ blogs })
  } catch (error) {
    console.error('Error fetching tenant blogs:', error)
    return NextResponse.json({ error: 'Failed to fetch blogs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: TenantBlogsRouteParams) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, description, slug, evernoteNotebook, theme } = body

    // Validate required fields
    if (!title || !slug) {
      return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 })
    }

    // Check if user has access to this tenant
    const tenantUser = await prisma.tenantUser.findFirst({
      where: {
        tenantId: params.id,
        userId: session.user.id
      }
    })

    if (!tenantUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if slug is already taken within this tenant
    const existingBlog = await prisma.blog.findFirst({
      where: { 
        slug,
        tenantId: params.id
      }
    })

    if (existingBlog) {
      return NextResponse.json({ error: 'Slug already taken within this tenant' }, { status: 400 })
    }

    // Create blog
    const blog = await prisma.blog.create({
      data: {
        title,
        description,
        slug,
        evernoteNotebook,
        theme: theme || 'default',
        userId: session.user.id,
        tenantId: params.id
      }
    })

    return NextResponse.json({ blog })
  } catch (error) {
    console.error('Error creating blog:', error)
    return NextResponse.json({ error: 'Failed to create blog' }, { status: 500 })
  }
}