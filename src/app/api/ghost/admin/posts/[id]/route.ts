import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentSource, ContentFormat } from '@prisma/client'
import { marked } from 'marked'

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
 * GET /api/ghost/admin/posts/{id} - Get specific post (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  console.log('👻 GET /api/ghost/admin/posts/[id] handler called for ID:', params.id)
  
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

    // Find the post by Ghost post ID
    const post = await prisma.post.findFirst({
      where: {
        ghostPostId: params.id,
        blogId: fullBlog.id,
        contentSource: ContentSource.GHOST
      }
    })

    if (!post) {
      return NextResponse.json(
        { errors: [{ message: 'Post not found' }] },
        { status: 404 }
      )
    }

    // Convert content for response
    const responseHtml = post.contentFormat === ContentFormat.MARKDOWN 
      ? await marked(post.content) 
      : post.content
    const responseMarkdown = post.contentFormat === ContentFormat.MARKDOWN 
      ? post.content 
      : null

    // Generate proper UUID format
    const ghostUuid = `${params.id.substring(0, 8)}-${params.id.substring(8, 12)}-${params.id.substring(12, 16)}-${params.id.substring(16, 20)}-${params.id.substring(20, 24)}000000000000`

    // Format response in Ghost format
    const ghostResponse = {
      id: params.id,
      uuid: ghostUuid,
      title: post.title,
      slug: post.slug,
      html: responseHtml,
      lexical: null,
      markdown: responseMarkdown,
      comment_id: post.id,
      plaintext: post.excerpt || '',
      feature_image: null,
      featured: false,
      visibility: 'public',
      email_recipient_filter: 'none',
      created_at: post.createdAt.toISOString(),
      updated_at: post.updatedAt.toISOString(),
      published_at: post.publishedAt?.toISOString() || null,
      custom_excerpt: post.excerpt || '',
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
      url: `${request.nextUrl.origin}/${fullBlog.user.slug || 'blog'}/${fullBlog.slug}/${post.slug}`,
      excerpt: post.excerpt || '',
      reading_time: Math.max(1, Math.round((post.content?.length || 0) / 265)),
      access: true,
      email_segment: 'all',
      status: post.isPublished ? 'published' : 'draft'
    }

    console.log('👻 Returning individual post:', post.title)

    return NextResponse.json({
      posts: [ghostResponse]
    })

  } catch (error) {
    console.error('👻 Error fetching Ghost post:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}