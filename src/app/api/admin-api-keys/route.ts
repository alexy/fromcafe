import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

/**
 * GET /api/admin-api-keys - Get Admin API Keys for user's blogs
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const blogId = searchParams.get('blogId')

    if (!blogId) {
      return NextResponse.json({ error: 'Blog ID required' }, { status: 400 })
    }

    // Verify user owns the blog
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        user: { email: session.user.email }
      }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Get Admin API Keys for this blog
    const apiKeys = await prisma.adminApiKey.findMany({
      where: { blogId },
      select: {
        id: true,
        keyId: true,
        name: true,
        description: true,
        createdAt: true,
        lastUsedAt: true
        // Note: Don't return the secret
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ apiKeys })

  } catch (error) {
    console.error('Error fetching Admin API Keys:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin-api-keys - Create new Admin API Key
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { blogId, name, description } = body

    if (!blogId) {
      return NextResponse.json({ error: 'Blog ID required' }, { status: 400 })
    }

    // Verify user owns the blog
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        user: { email: session.user.email }
      },
      include: { user: true }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Generate Admin API Key ID and Secret
    const keyId = randomBytes(12).toString('hex') // 24 characters
    const secret = randomBytes(32).toString('hex') // 64 characters
    
    // Create the API key
    const apiKey = await prisma.adminApiKey.create({
      data: {
        keyId,
        secret,
        blogId,
        userId: blog.userId,
        name: name || 'Admin API Key',
        description
      }
    })

    // Generate blog URL for response
    const blogUrl = blog.customDomain 
      ? `https://${blog.customDomain}`
      : blog.subdomain
      ? `https://${blog.subdomain}.from.cafe`
      : `https://from.cafe/${blog.user.slug || 'blog'}/${blog.slug}`

    return NextResponse.json({
      id: apiKey.id,
      keyId: apiKey.keyId,
      secret: apiKey.secret, // Only return secret on creation
      name: apiKey.name,
      description: apiKey.description,
      createdAt: apiKey.createdAt,
      // Additional info for client setup
      apiUrl: `${blogUrl.replace(/\/$/, '')}/ghost/api/admin`,
      blogUrl
    })

  } catch (error) {
    console.error('Error creating Admin API Key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin-api-keys - Delete Admin API Key
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('keyId')

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID required' }, { status: 400 })
    }

    // Find and verify ownership
    const apiKey = await prisma.adminApiKey.findFirst({
      where: {
        keyId,
        user: { email: session.user.email }
      }
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 404 })
    }

    // Delete the API key
    await prisma.adminApiKey.delete({
      where: { id: apiKey.id }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting Admin API Key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}