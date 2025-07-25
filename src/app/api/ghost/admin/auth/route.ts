import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'

interface GhostTokenRequest {
  blogId: string
  expiresIn?: string // e.g., '24h', '7d', '30d'
}

interface GhostTokenResponse {
  token: string
  expiresAt: string
  blog: {
    id: string
    title: string
    url: string
  }
}

/**
 * Generate a Ghost-compatible Admin API key (id:secret format)
 */
function generateGhostAdminKey(blogId: string, userId: string): string {
  // Generate 24-character ObjectId-like ID (matching Ghost format)
  // Use timestamp (8 chars) + machine id (6 chars) + process id (4 chars) + counter (6 chars)
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0')
  const machineId = createHash('sha256').update(blogId).digest('hex').substring(0, 6)
  const processId = createHash('sha256').update(userId).digest('hex').substring(0, 4)
  const counter = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
  const id = timestamp + machineId + processId + counter
  
  // Generate 64-character hex secret (same as before)
  const secretData = `${blogId}:${userId}:${Date.now()}:${Math.random()}`
  const secret = createHash('sha256').update(secretData).digest('hex')
  
  // Format: id:secret (like real Ghost Admin API keys)
  return `${id}:${secret}`
}

/**
 * POST /api/ghost/admin/auth - Generate Ghost API token
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: GhostTokenRequest = await request.json()
    const { blogId, expiresIn = '1y' } = body

    if (!blogId) {
      return NextResponse.json({ 
        error: 'Blog ID is required' 
      }, { status: 400 })
    }

    // Verify user owns the blog
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        userId: session.user.id
      },
      include: {
        user: true
      }
    })

    if (!blog) {
      return NextResponse.json({ 
        error: 'Blog not found or access denied' 
      }, { status: 404 })
    }

    // Enable Ghost as a content source if not already enabled
    if (!blog.contentSources.includes('GHOST')) {
      await prisma.blog.update({
        where: { id: blogId },
        data: {
          contentSources: {
            set: [...blog.contentSources, 'GHOST']
          }
        }
      })
    }

    // Calculate expiration date
    const expirationMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
      'never': 100 * 365 * 24 * 60 * 60 * 1000 // 100 years
    }[expiresIn] || 365 * 24 * 60 * 60 * 1000 // Default to 1 year

    const expiresAtDate = new Date(Date.now() + expirationMs)

    // Generate Admin API key
    const token = generateGhostAdminKey(blogId, session.user.id)
    
    // Store token in database
    await prisma.ghostToken.create({
      data: {
        token,
        blogId,
        userId: session.user.id,
        expiresAt: expiresAtDate
      }
    })

    const expiresAt = expiresAtDate.toISOString()

    // Generate blog URL
    const blogUrl = blog.customDomain 
      ? `https://${blog.customDomain}`
      : blog.subdomain
      ? `https://${blog.subdomain}.from.cafe`
      : `https://from.cafe/${blog.user.slug}/${blog.slug}`

    const response: GhostTokenResponse = {
      token,
      expiresAt,
      blog: {
        id: blog.id,
        title: blog.title,
        url: blogUrl
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error generating Ghost token:', error)
    return NextResponse.json({ 
      error: 'Failed to generate token' 
    }, { status: 500 })
  }
}

/**
 * GET /api/ghost/admin/auth - Get blog info for Ghost API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const blogId = searchParams.get('blogId')

    if (!blogId) {
      return NextResponse.json({ 
        error: 'Blog ID is required' 
      }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get blog info
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        userId: session.user.id
      },
      include: {
        user: true,
        _count: {
          select: {
            posts: {
              where: {
                contentSource: 'GHOST'
              }
            }
          }
        }
      }
    })

    if (!blog) {
      return NextResponse.json({ 
        error: 'Blog not found or access denied' 
      }, { status: 404 })
    }

    // Generate blog URL and corresponding API endpoint
    const blogUrl = blog.customDomain 
      ? `https://${blog.customDomain}`
      : blog.subdomain
      ? `https://${blog.subdomain}.from.cafe`
      : `https://from.cafe/${blog.user.slug}/${blog.slug}`

    // Generate blog-specific Ghost API base URL (clients will append their own paths)
    const apiEndpoint = blog.customDomain 
      ? `https://${blog.customDomain}`
      : blog.subdomain
      ? `https://${blog.subdomain}.from.cafe`
      : `https://from.cafe/${blog.slug}`

    // Get existing tokens for this blog
    const existingTokens = await prisma.ghostToken.findMany({
      where: {
        blogId: blog.id,
        userId: session.user.id,
        expiresAt: { gt: new Date() } // Only non-expired tokens
      },
      orderBy: { createdAt: 'desc' },
      take: 1 // Get the most recent token
    })

    const currentToken = existingTokens.length > 0 ? {
      token: existingTokens[0].token,
      expiresAt: existingTokens[0].expiresAt.toISOString(),
      blog: {
        id: blog.id,
        title: blog.title,
        url: blog.customDomain 
          ? `https://${blog.customDomain}`
          : blog.subdomain
          ? `https://${blog.subdomain}.from.cafe`
          : `https://from.cafe/${blog.user.slug}/${blog.slug}`
      }
    } : null

    return NextResponse.json({
      blog: {
        id: blog.id,
        title: blog.title,
        description: blog.description,
        url: blogUrl,
        ghostEnabled: blog.contentSources.includes('GHOST'),
        ghostPostCount: blog._count.posts
      },
      apiEndpoint,
      authEndpoint: `${request.nextUrl.origin}/api/ghost/admin/auth`,
      currentToken
    })

  } catch (error) {
    console.error('Error getting Ghost auth info:', error)
    return NextResponse.json({ 
      error: 'Failed to get auth info' 
    }, { status: 500 })
  }
}