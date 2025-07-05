import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentSource } from '@prisma/client'

// Ghost-compatible post structure
interface GhostPost {
  id?: string
  title: string
  slug?: string
  html?: string
  lexical?: string
  mobiledoc?: string
  excerpt?: string
  status?: 'published' | 'draft' | 'scheduled'
  published_at?: string
  created_at?: string
  updated_at?: string
  tags?: Array<string | { name: string }>
  authors?: Array<string | { email: string }>
  meta_title?: string
  meta_description?: string
  feature_image?: string
}

interface GhostPostRequest {
  posts: GhostPost[]
}

interface GhostPostResponse {
  posts: Array<{
    id: string
    uuid: string
    title: string
    slug: string
    html: string
    excerpt: string
    status: string
    created_at: string
    updated_at: string
    published_at: string | null
    url: string
  }>
}

/**
 * Parse Ghost token and look up associated blog/user
 */
async function parseGhostToken(authHeader: string): Promise<{ blogId: string; userId: string } | null> {
  try {
    if (!authHeader.startsWith('Ghost ')) {
      return null
    }

    const token = authHeader.substring(6) // Remove 'Ghost ' prefix
    
    // Validate token format: 24-char-id:64-char-hex
    if (!/^[a-f0-9]{24}:[a-f0-9]{64}$/.test(token)) {
      console.log('Invalid token format:', token.length, 'chars')
      return null
    }
    
    // Look up the token in our database
    const ghostToken = await prisma.ghostToken.findUnique({
      where: { token },
      select: {
        blogId: true,
        userId: true,
        expiresAt: true
      }
    })

    if (!ghostToken) {
      return null
    }

    // Check if token has expired
    if (ghostToken.expiresAt < new Date()) {
      // Token expired, clean it up
      await prisma.ghostToken.delete({
        where: { token }
      })
      return null
    }

    return {
      blogId: ghostToken.blogId,
      userId: ghostToken.userId
    }
  } catch (error) {
    console.error('Error parsing Ghost token:', error)
    return null
  }
}

/**
 * Generate slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Ensure unique slug for the blog
 */
async function ensureUniqueSlug(baseSlug: string, blogId: string, excludePostId?: string): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existingPost = await prisma.post.findFirst({
      where: {
        blogId,
        slug,
        ...(excludePostId && { id: { not: excludePostId } })
      }
    })

    if (!existingPost) {
      return slug
    }

    slug = `${baseSlug}-${counter}`
    counter++
  }
}

/**
 * Convert HTML content to plain text for excerpt
 */
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 300)
}

/**
 * POST /api/ghost/admin/posts - Create posts (Ghost Admin API compatible)
 */
export async function POST(request: NextRequest) {
  try {
    // Check for required headers
    const acceptVersion = request.headers.get('accept-version')
    if (!acceptVersion) {
      return NextResponse.json(
        { errors: [{ message: 'Accept-Version header is required' }] },
        { status: 400 }
      )
    }

    // Parse authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { errors: [{ message: 'Authorization header is required' }] },
        { status: 401 }
      )
    }

    const tokenData = await parseGhostToken(authHeader)
    if (!tokenData) {
      return NextResponse.json(
        { errors: [{ message: 'Invalid authorization token' }] },
        { status: 401 }
      )
    }

    // Verify blog exists and user has access
    const blog = await prisma.blog.findFirst({
      where: {
        id: tokenData.blogId,
        userId: tokenData.userId
      },
      include: {
        user: true
      }
    })

    if (!blog) {
      return NextResponse.json(
        { errors: [{ message: 'Blog not found or access denied' }] },
        { status: 404 }
      )
    }

    // Parse request body
    const body: GhostPostRequest = await request.json()
    
    if (!body.posts || !Array.isArray(body.posts)) {
      return NextResponse.json(
        { errors: [{ message: 'Invalid request format. Expected posts array.' }] },
        { status: 400 }
      )
    }

    const createdPosts = []

    for (const ghostPost of body.posts) {
      // Validate required fields
      if (!ghostPost.title) {
        return NextResponse.json(
          { errors: [{ message: 'Post title is required' }] },
          { status: 400 }
        )
      }

      // Extract content from different formats
      let content = ''
      if (ghostPost.html) {
        content = ghostPost.html
      } else if (ghostPost.lexical) {
        // For now, store lexical as-is. In production, you might convert to HTML
        content = ghostPost.lexical
      } else if (ghostPost.mobiledoc) {
        // For now, store mobiledoc as-is. In production, you might convert to HTML
        content = ghostPost.mobiledoc
      }

      // Generate slug
      const baseSlug = ghostPost.slug || generateSlug(ghostPost.title)
      const uniqueSlug = await ensureUniqueSlug(baseSlug, blog.id)

      // Generate excerpt
      const excerpt = ghostPost.excerpt || (content ? htmlToText(content) : '')

      // Determine publication status
      const isPublished = ghostPost.status === 'published'
      const publishedAt = isPublished 
        ? (ghostPost.published_at ? new Date(ghostPost.published_at) : new Date())
        : null

      // Create the post
      const post = await prisma.post.create({
        data: {
          blogId: blog.id,
          title: ghostPost.title,
          content,
          excerpt: excerpt.substring(0, 500), // Limit excerpt length
          slug: uniqueSlug,
          isPublished,
          publishedAt,
          contentSource: ContentSource.GHOST,
          sourceUrl: `${request.nextUrl.origin}/api/ghost/admin/posts`, // Reference to our API
          sourceUpdatedAt: new Date()
        }
      })

      // Format response in Ghost format
      const ghostResponse = {
        id: post.id,
        uuid: post.id, // Use same ID as UUID for simplicity
        title: post.title,
        slug: post.slug,
        html: post.content,
        excerpt: post.excerpt || '',
        status: post.isPublished ? 'published' : 'draft',
        created_at: post.createdAt.toISOString(),
        updated_at: post.updatedAt.toISOString(),
        published_at: post.publishedAt?.toISOString() || null,
        url: `${request.nextUrl.origin}/${blog.user.slug || 'blog'}/${blog.slug}/${post.slug}`
      }

      createdPosts.push(ghostResponse)
    }

    // Return Ghost-compatible response
    const response: GhostPostResponse = {
      posts: createdPosts
    }

    return NextResponse.json(response, { 
      status: 201,
      headers: {
        'X-Cache-Invalidate': '/*'
      }
    })

  } catch (error) {
    console.error('Error creating Ghost post:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ghost/admin/posts - List posts (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest) {
  try {
    // Parse authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { errors: [{ message: 'Authorization header is required' }] },
        { status: 401 }
      )
    }

    const tokenData = await parseGhostToken(authHeader)
    if (!tokenData) {
      return NextResponse.json(
        { errors: [{ message: 'Invalid authorization token' }] },
        { status: 401 }
      )
    }

    // Verify blog exists and user has access
    const blog = await prisma.blog.findFirst({
      where: {
        id: tokenData.blogId,
        userId: tokenData.userId
      },
      include: {
        user: true
      }
    })

    if (!blog) {
      return NextResponse.json(
        { errors: [{ message: 'Blog not found or access denied' }] },
        { status: 404 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '15')
    const page = parseInt(searchParams.get('page') || '1')
    const status = searchParams.get('filter')?.includes('published') ? 'published' : undefined

    // Fetch posts
    const posts = await prisma.post.findMany({
      where: {
        blogId: blog.id,
        contentSource: ContentSource.GHOST,
        ...(status && { isPublished: status === 'published' })
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    // Format posts in Ghost format
    const ghostPosts = posts.map(post => ({
      id: post.id,
      uuid: post.id,
      title: post.title,
      slug: post.slug,
      html: post.content,
      excerpt: post.excerpt || '',
      status: post.isPublished ? 'published' : 'draft',
      created_at: post.createdAt.toISOString(),
      updated_at: post.updatedAt.toISOString(),
      published_at: post.publishedAt?.toISOString() || null,
      url: `${request.nextUrl.origin}/${blog.user.slug || 'blog'}/${blog.slug}/${post.slug}`
    }))

    return NextResponse.json({
      posts: ghostPosts,
      meta: {
        pagination: {
          page,
          limit,
          pages: Math.ceil(posts.length / limit),
          total: posts.length
        }
      }
    })

  } catch (error) {
    console.error('Error fetching Ghost posts:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}