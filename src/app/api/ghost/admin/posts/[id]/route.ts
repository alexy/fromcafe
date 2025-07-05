import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentSource, ContentFormat } from '@prisma/client'
import { marked } from 'marked'
import { validateGhostAuth } from '@/lib/ghost-auth'
import { ContentProcessor } from '@/lib/content-processor'

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

// Ghost-compatible post structure for updates
interface GhostPost {
  id?: string
  title: string
  slug?: string
  html?: string
  lexical?: string
  mobiledoc?: string
  markdown?: string // Ulysses sends Markdown XL content
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
 * PUT /api/ghost/admin/posts/{id} - Update specific post (Ghost Admin API compatible)
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  console.log('👻 PUT /api/ghost/admin/posts/[id] handler called for ID:', params.id)
  
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
    
    if (!body.posts || !Array.isArray(body.posts) || body.posts.length === 0) {
      return NextResponse.json(
        { errors: [{ message: 'Invalid request format. Expected posts array.' }] },
        { status: 400 }
      )
    }

    const ghostPost = body.posts[0] // Update first post in array

    // Find the existing post
    const existingPost = await prisma.post.findFirst({
      where: {
        ghostPostId: params.id,
        blogId: fullBlog.id,
        contentSource: ContentSource.GHOST
      }
    })

    if (!existingPost) {
      return NextResponse.json(
        { errors: [{ message: 'Post not found' }] },
        { status: 404 }
      )
    }

    // Extract content from different formats - prioritize Markdown from Ulysses
    let content = ''
    let isMarkdownContent = false
    
    if (ghostPost.markdown) {
      // Ulysses sends Markdown XL - store as-is
      content = ghostPost.markdown
      isMarkdownContent = true
    } else if (ghostPost.html) {
      content = ghostPost.html
    } else if (ghostPost.lexical) {
      // Store lexical as-is for now
      content = ghostPost.lexical
    } else if (ghostPost.mobiledoc) {
      // Store mobiledoc as-is for now
      content = ghostPost.mobiledoc
    }

    // Generate slug if title changed
    let finalSlug = existingPost.slug
    if (ghostPost.title && ghostPost.title !== existingPost.title) {
      const baseSlug = ghostPost.slug || generateSlug(ghostPost.title)
      finalSlug = await ensureUniqueSlug(baseSlug, fullBlog.id, existingPost.id)
    }

    // Determine publication status
    const isPublished = ghostPost.status === 'published'
    const publishedAt = isPublished 
      ? (ghostPost.published_at ? new Date(ghostPost.published_at) : new Date())
      : null

    // Process content with unified image handling
    const contentProcessor = new ContentProcessor()
    let processingResult
    
    if (isMarkdownContent) {
      // Convert Markdown to HTML for image processing only
      const htmlContent = await marked(content)
      processingResult = await contentProcessor.processGhostContent(htmlContent, existingPost.id)
      // But store the original Markdown content, not the processed HTML
      processingResult.processedContent = content
    } else {
      processingResult = await contentProcessor.processGhostContent(content, existingPost.id)
    }
    
    // Generate excerpt from content (use HTML version for excerpt generation)
    const htmlForExcerpt = isMarkdownContent ? await marked(content) : content
    const excerpt = ghostPost.excerpt || contentProcessor.generateExcerpt(htmlForExcerpt)

    // Update the post
    const updatedPost = await prisma.post.update({
      where: { id: existingPost.id },
      data: {
        title: ghostPost.title || existingPost.title,
        content: processingResult.processedContent,
        excerpt: excerpt.substring(0, 500), // Limit excerpt length
        slug: finalSlug,
        isPublished,
        publishedAt,
        contentFormat: isMarkdownContent ? ContentFormat.MARKDOWN : ContentFormat.HTML,
        sourceUpdatedAt: new Date()
      }
    })

    // Log image processing results
    if (processingResult.imageCount > 0) {
      console.log(`Processed ${processingResult.imageCount} images for updated Ghost post "${ghostPost.title}"`)
    }
    if (processingResult.errors.length > 0) {
      console.warn(`Image processing errors for updated Ghost post ${updatedPost.id}:`, processingResult.errors)
    }

    // Convert content for response
    const responseHtml = updatedPost.contentFormat === ContentFormat.MARKDOWN 
      ? await marked(updatedPost.content) 
      : updatedPost.content
    const responseMarkdown = updatedPost.contentFormat === ContentFormat.MARKDOWN 
      ? updatedPost.content 
      : null

    // Generate proper UUID format
    const ghostUuid = `${params.id.substring(0, 8)}-${params.id.substring(8, 12)}-${params.id.substring(12, 16)}-${params.id.substring(16, 20)}-${params.id.substring(20, 24)}000000000000`

    // Format response in Ghost format
    const ghostResponse = {
      id: params.id,
      uuid: ghostUuid,
      title: updatedPost.title,
      slug: updatedPost.slug,
      html: responseHtml,
      lexical: null,
      markdown: responseMarkdown,
      comment_id: updatedPost.id,
      plaintext: updatedPost.excerpt || '',
      feature_image: null,
      featured: false,
      visibility: 'public',
      email_recipient_filter: 'none',
      created_at: updatedPost.createdAt.toISOString(),
      updated_at: updatedPost.updatedAt.toISOString(),
      published_at: updatedPost.publishedAt?.toISOString() || null,
      custom_excerpt: updatedPost.excerpt || '',
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
      url: `${request.nextUrl.origin}/${fullBlog.user.slug || 'blog'}/${fullBlog.slug}/${updatedPost.slug}`,
      excerpt: updatedPost.excerpt || '',
      reading_time: Math.max(1, Math.round((updatedPost.content?.length || 0) / 265)),
      access: true,
      email_segment: 'all',
      status: updatedPost.isPublished ? 'published' : 'draft'
    }

    console.log('👻 Successfully updated post:', updatedPost.title)

    return NextResponse.json({
      posts: [ghostResponse]
    }, { 
      status: 200,
      headers: {
        'X-Cache-Invalidate': '/*'
      }
    })

  } catch (error) {
    console.error('👻 Error updating Ghost post:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}