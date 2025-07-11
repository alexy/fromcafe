import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentSource, ContentFormat } from '@prisma/client'
import { ContentProcessor } from '@/lib/content-processor'
import { tagPostBySource } from '@/lib/blog/tags'
import { createHash } from 'crypto'
import { marked } from 'marked'
import { validateGhostAuth } from '@/lib/ghost-auth'
import { 
  processGhostContent, 
  createMarkdownRenderer, 
  type GhostPostRequest 
} from '@/lib/ghost-content-processor'
import { generateSlug, ensureUniqueSlug } from '@/lib/ghost-utils'

// Interfaces are now imported from ghost-content-processor

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

// Utility functions are now imported from ghost-utils module


/**
 * POST /api/ghost/admin/posts - Create posts (Ghost Admin API compatible)
 */
export async function POST(request: NextRequest) {
  console.log('👻 POST /api/ghost/admin/posts handler called')
  console.log('👻 POST request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    // Accept-Version header is optional - Ulysses doesn't always send it
    const acceptVersion = request.headers.get('accept-version')
    console.log('👻 POST: Accept-Version header:', acceptVersion || 'not provided')

    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')
    const source = searchParams.get('source') // ?source=html parameter
    
    console.log('👻 POST: source parameter:', source || 'not provided')

    // Validate authentication and find blog
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      return authResult.error
    }
    
    const { tokenData, blog } = authResult

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

      // Process content using shared logic
      const contentProcessingResult = await processGhostContent(ghostPost, source)
      const { content, isMarkdownContent, contentFormat } = contentProcessingResult

      // Generate slug
      const baseSlug = ghostPost.slug || generateSlug(ghostPost.title)
      const uniqueSlug = await ensureUniqueSlug(baseSlug, fullBlog.id)

      // Determine publication status
      const isPublished = ghostPost.status === 'published'
      // For new posts, only set publishedAt if being published
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
          contentFormat,
          ghostPostId: ghostPost.id || undefined, // Use provided ID if available
          sourceUrl: `${request.nextUrl.origin}/api/ghost/admin/posts`, // Reference to our API
          sourceUpdatedAt: new Date()
        }
      })

      // Process content with unified image handling
      const contentProcessor = new ContentProcessor()
      let processingResult
      
      // Use shared markdown renderer
      const renderer = createMarkdownRenderer()
      
      if (isMarkdownContent && source !== 'html') {
        // Convert Markdown to HTML for image processing only
        const htmlContent = await marked(content, { renderer })
        processingResult = await contentProcessor.processGhostContent(htmlContent, post.id, fullBlog.showCameraMake)
        // But store the original Markdown content, not the processed HTML
        processingResult.processedContent = content
      } else {
        // For HTML content (including when source=html is specified)
        processingResult = await contentProcessor.processGhostContent(content, post.id, fullBlog.showCameraMake)
      }
      
      // Generate excerpt from content (use HTML version for excerpt generation)
      const htmlForExcerpt = (isMarkdownContent && source !== 'html') ? await marked(content, { renderer }) : content
      const excerpt = ghostPost.excerpt || contentProcessor.generateExcerpt(htmlForExcerpt)

      // Generate Ghost-compatible ID for this post if not already set
      // Use provided ID if available, otherwise generate one
      const ghostPostId = post.ghostPostId || ghostPost.id || createHash('sha256').update(post.id).digest('hex').substring(0, 24)
      
      // Update the post with processed content, excerpt, and Ghost post ID
      await prisma.post.update({
        where: { id: post.id },
        data: {
          content: processingResult.processedContent,
          excerpt: excerpt.substring(0, 500), // Limit excerpt length
          ghostPostId: ghostPostId // Store the Ghost-compatible ID
        }
      })

      // Tag the post as coming from Ghost
      await tagPostBySource(post.id, ContentSource.GHOST)

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
      
      // Convert content for response
      const responseHtml = updatedPost!.contentFormat === ContentFormat.MARKDOWN 
        ? await marked(updatedPost!.content, { renderer }) 
        : updatedPost!.content
      const responseMarkdown = updatedPost!.contentFormat === ContentFormat.MARKDOWN 
        ? updatedPost!.content 
        : null
      
      const ghostResponse = {
        id: responseGhostId,
        uuid: ghostUuid,
        title: updatedPost!.title,
        slug: updatedPost!.slug,
        html: responseHtml,
        lexical: null, // We're using HTML/Markdown format, not Lexical
        markdown: responseMarkdown, // Return original Markdown if available
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
        url: updatedPost!.isPublished 
          ? `${request.nextUrl.origin}/${fullBlog.user.slug || 'blog'}/${fullBlog.slug}/${updatedPost!.slug}`
          : `${request.nextUrl.origin}/p/${responseGhostId}`,
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

    // Validate authentication and find blog
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      return authResult.error
    }
    
    const { blog } = authResult

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
    const ghostPosts = posts.map(post => {
      // Use Ghost post ID if available, otherwise generate from database ID
      const ghostId = post.ghostPostId || createHash('sha256').update(post.id).digest('hex').substring(0, 24)
      return {
        id: ghostId,
        uuid: ghostId,
        title: post.title,
        slug: post.slug,
        html: post.content,
        excerpt: post.excerpt || '',
        status: post.isPublished ? 'published' : 'draft',
        created_at: post.createdAt.toISOString(),
        updated_at: post.updatedAt.toISOString(),
        published_at: post.publishedAt?.toISOString() || null,
        url: post.isPublished 
          ? `${request.nextUrl.origin}/${fullBlog.user.slug || 'blog'}/${fullBlog.slug}/${post.slug}`
          : `${request.nextUrl.origin}/p/${ghostId}`
      }
    })

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