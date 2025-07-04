import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentSource } from '@prisma/client'
import { ContentProcessor } from '@/lib/content-processor'
import { createHash } from 'crypto'

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
  posts: Array<Record<string, unknown>>
  meta?: {
    pagination: {
      page: number
      limit: number
      pages: number
      total: number
      next: null | number
      prev: null | number
    }
  }
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
 * Find blog by domain, subdomain, or slug
 */
async function findBlogByIdentifier(
  domain?: string, 
  subdomain?: string, 
  blogSlug?: string
): Promise<{ id: string; userId: string; user: { slug: string | null } } | null> {
  try {
    let whereClause: { customDomain?: string; subdomain?: string; slug?: string } = {}
    
    if (domain) {
      // Custom domain
      whereClause = { customDomain: domain }
    } else if (subdomain) {
      // Subdomain
      whereClause = { subdomain: subdomain }
    } else if (blogSlug) {
      // Path-based blog slug
      whereClause = { slug: blogSlug }
    } else {
      return null
    }

    const blog = await prisma.blog.findFirst({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            slug: true
          }
        }
      }
    })

    return blog
  } catch (error) {
    console.error('Error finding blog by identifier:', error)
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

    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')

    // Find the blog by URL structure
    const blog = await findBlogByIdentifier(domain || undefined, subdomain || undefined, blogSlug || undefined)
    if (!blog) {
      return NextResponse.json(
        { errors: [{ message: 'Blog not found for this URL' }] },
        { status: 404 }
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

    // Verify token is valid for this specific blog
    if (tokenData.blogId !== blog.id) {
      return NextResponse.json(
        { errors: [{ message: 'Authorization token not valid for this blog' }] },
        { status: 403 }
      )
    }

    // Get full blog details
    const fullBlog = await prisma.blog.findUnique({
      where: { id: blog.id },
      include: { user: true }
    })

    if (!fullBlog) {
      return NextResponse.json(
        { errors: [{ message: 'Blog not found' }] },
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
      const uniqueSlug = await ensureUniqueSlug(baseSlug, fullBlog.id)

      // Determine publication status
      const isPublished = ghostPost.status === 'published'
      const publishedAt = isPublished 
        ? (ghostPost.published_at ? new Date(ghostPost.published_at) : new Date())
        : null

      // Check for existing Ghost post if ID is provided
      if (ghostPost.id) {
        const existingPost = await prisma.post.findFirst({
          where: {
            ghostPostId: ghostPost.id,
            blogId: fullBlog.id
          }
        })
        
        if (existingPost) {
          return NextResponse.json(
            { errors: [{ message: `Post with ID ${ghostPost.id} already exists` }] },
            { status: 409 }
          )
        }
      }

      // Create the post first (we need the post ID for image processing)
      const post = await prisma.post.create({
        data: {
          blogId: fullBlog.id,
          title: ghostPost.title,
          content: '', // Will be updated after image processing
          excerpt: '', // Will be updated after processing
          slug: uniqueSlug,
          isPublished,
          publishedAt,
          contentSource: ContentSource.GHOST,
          ghostPostId: ghostPost.id || undefined, // Use provided ID if available
          sourceUrl: `${request.nextUrl.origin}/api/ghost/admin/posts`, // Reference to our API
          sourceUpdatedAt: new Date()
        }
      })

      // Process content with unified image handling
      const contentProcessor = new ContentProcessor()
      const processingResult = await contentProcessor.processGhostContent(content, post.id)
      
      // Generate excerpt from processed content
      const excerpt = ghostPost.excerpt || contentProcessor.generateExcerpt(processingResult.processedContent)

      // Generate Ghost-compatible ID for this post if not already set
      const ghostPostId = post.ghostPostId || createHash('sha256').update(post.id).digest('hex').substring(0, 24)
      
      // Update the post with processed content, excerpt, and Ghost post ID
      await prisma.post.update({
        where: { id: post.id },
        data: {
          content: processingResult.processedContent,
          excerpt: excerpt.substring(0, 500), // Limit excerpt length
          ghostPostId: ghostPostId // Store the Ghost-compatible ID
        }
      })

      // Log image processing results
      if (processingResult.imageCount > 0) {
        console.log(`Processed ${processingResult.imageCount} images for Ghost post "${ghostPost.title}"`)
      }
      if (processingResult.errors.length > 0) {
        console.warn(`Image processing errors for Ghost post ${post.id}:`, processingResult.errors)
      }

      // Get the updated post with processed content
      const updatedPost = await prisma.post.findUnique({
        where: { id: post.id }
      })

      // Format response in Ghost format with all required fields
      // Use the stored Ghost post ID
      const responseGhostId = updatedPost!.ghostPostId!
      // Generate proper UUID format
      const ghostUuid = `${responseGhostId.substring(0, 8)}-${responseGhostId.substring(8, 12)}-${responseGhostId.substring(12, 16)}-${responseGhostId.substring(16, 20)}-${responseGhostId.substring(20, 24)}000000000000`
      
      const ghostResponse = {
        id: responseGhostId,
        uuid: ghostUuid,
        title: updatedPost!.title,
        slug: updatedPost!.slug,
        html: updatedPost!.content,
        lexical: null, // We're using HTML format, not Lexical
        comment_id: updatedPost!.id,
        plaintext: updatedPost!.excerpt || '',
        feature_image: null,
        featured: false,
        visibility: 'public',
        email_recipient_filter: 'none',
        created_at: updatedPost!.createdAt.toISOString(),
        updated_at: updatedPost!.updatedAt.toISOString(),
        published_at: updatedPost!.publishedAt?.toISOString() || null,
        custom_excerpt: updatedPost!.excerpt || '',
        codeinjection_head: null,
        codeinjection_foot: null,
        custom_template: null,
        canonical_url: null,
        tags: [],
        authors: [{
          id: tokenData.userId,
          name: 'Author',
          slug: 'author',
          email: null,
          profile_image: null,
          cover_image: null,
          bio: null,
          website: null,
          location: null,
          facebook: null,
          twitter: null,
          accessibility: null,
          status: 'active',
          meta_title: null,
          meta_description: null,
          tour: null,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          roles: [{
            id: 'owner',
            name: 'Owner',
            description: 'Blog owner',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]
        }],
        primary_author: {
          id: tokenData.userId,
          name: 'Author',
          slug: 'author'
        },
        primary_tag: null,
        url: `${request.nextUrl.origin}/${fullBlog.user.slug || 'blog'}/${fullBlog.slug}/${updatedPost!.slug}`,
        excerpt: updatedPost!.excerpt || '',
        reading_time: Math.max(1, Math.round((updatedPost!.content?.length || 0) / 265)), // Estimate reading time
        access: true,
        email_segment: 'all',
        status: updatedPost!.isPublished ? 'published' : 'draft'
      }

      createdPosts.push(ghostResponse)
    }

    // Return Ghost-compatible response with metadata
    const response: GhostPostResponse = {
      posts: createdPosts,
      meta: {
        pagination: {
          page: 1,
          limit: createdPosts.length,
          pages: 1,
          total: createdPosts.length,
          next: null,
          prev: null
        }
      }
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
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')

    // Find the blog by URL structure
    const blog = await findBlogByIdentifier(domain || undefined, subdomain || undefined, blogSlug || undefined)
    if (!blog) {
      return NextResponse.json(
        { errors: [{ message: 'Blog not found for this URL' }] },
        { status: 404 }
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

    // Verify token is valid for this specific blog
    if (tokenData.blogId !== blog.id) {
      return NextResponse.json(
        { errors: [{ message: 'Authorization token not valid for this blog' }] },
        { status: 403 }
      )
    }

    // Get full blog details
    const fullBlog = await prisma.blog.findUnique({
      where: { id: blog.id },
      include: { user: true }
    })

    if (!fullBlog) {
      return NextResponse.json(
        { errors: [{ message: 'Blog not found' }] },
        { status: 404 }
      )
    }

    // Get additional query parameters
    const limit = parseInt(searchParams.get('limit') || '15')
    const page = parseInt(searchParams.get('page') || '1')
    const status = searchParams.get('filter')?.includes('published') ? 'published' : undefined

    // Fetch posts
    const posts = await prisma.post.findMany({
      where: {
        blogId: fullBlog.id,
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
      url: `${request.nextUrl.origin}/${fullBlog.user.slug || 'blog'}/${fullBlog.slug}/${post.slug}`
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