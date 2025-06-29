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
    const { domain, blogId } = body

    // Check if user owns the blog
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        userId: session.user.id,
      },
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Check if domain is already taken
    const existingDomain = await prisma.domain.findUnique({
      where: { domain },
    })

    if (existingDomain) {
      return NextResponse.json({ error: 'Domain already in use' }, { status: 400 })
    }

    // Create domain record
    const domainRecord = await prisma.domain.create({
      data: {
        domain,
        blogId,
        isVerified: false,
      },
    })

    // Update blog with custom domain
    await prisma.blog.update({
      where: { id: blogId },
      data: { customDomain: domain },
    })

    return NextResponse.json({ 
      domain: domainRecord,
      message: 'Domain added successfully. Please verify ownership by adding a CNAME record.'
    })
  } catch (error) {
    console.error('Error adding domain:', error)
    return NextResponse.json({ error: 'Failed to add domain' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const domains = await prisma.domain.findMany({
      where: {
        blog: {
          userId: session.user.id,
        },
      },
      include: {
        blog: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    })

    return NextResponse.json({ domains })
  } catch (error) {
    console.error('Error fetching domains:', error)
    return NextResponse.json({ error: 'Failed to fetch domains' }, { status: 500 })
  }
}