import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentSource, ContentFormat } from '@prisma/client'
import { marked } from 'marked'
import { validateGhostAuth } from '@/lib/ghost-auth'
import { ContentProcessor } from '@/lib/content-processor'

// Configure route for handling larger payloads and longer processing times
export const maxDuration = 60 // Allow up to 60 seconds for large image processing
export const runtime = 'nodejs' // Use Node.js runtime for better performance with large payloads
export const preferredRegion = 'auto' // Allow Vercel to choose optimal region for large payloads

/**
 * GET /api/ghost/admin/posts/{id} - Get specific post (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  console.log('👻 GET /api/ghost/admin/posts/[id] handler called for ID:', params.id)
  
  try {
    // Get blog identifier and other query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')
    const formats = searchParams.get('formats')
    const include = searchParams.get('include')
    
    console.log('👻 GET query params:', { domain, subdomain, blogSlug, formats, include })
    console.log('👻 Full request URL:', request.url)
    console.log('👻 Starting authentication...')

    // Validate authentication and find blog
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('👻 Authentication failed')
      return authResult.error
    }
    
    const { tokenData, blog } = authResult
    console.log('👻 Authentication successful, blog ID:', blog.id)

    // Get full blog details
    const fullBlog = await prisma.blog.findUnique({
      where: { id: blog.id },
      include: { user: true }
    })

    if (!fullBlog) {
      console.log('👻 Blog not found in database')
      return NextResponse.json(
        { errors: [{ message: 'Blog not found' }] },
        { status: 404 }
      )
    }
    console.log('👻 Found blog:', fullBlog.title)

    // Find the post by Ghost post ID
    const post = await prisma.post.findFirst({
      where: {
        ghostPostId: params.id,
        blogId: fullBlog.id,
        contentSource: ContentSource.GHOST
      }
    })

    if (!post) {
      console.log('👻 Post not found with Ghost ID:', params.id)
      return NextResponse.json(
        { errors: [{ message: 'Post not found' }] },
        { status: 404 }
      )
    }
    console.log('👻 Found post:', post.title)

    // Configure marked to NOT wrap images in figure tags to prevent nesting
    const renderer = new marked.Renderer()
    renderer.image = function({ href, title, text }) {
      return `<img src="${href}" alt="${text || ''}"${title ? ` title="${title}"` : ''} />`
    }
    
    // Convert content for response
    const responseHtml = post.contentFormat === ContentFormat.MARKDOWN 
      ? await marked(post.content, { renderer }) 
      : post.content
    const responseMarkdown = post.contentFormat === ContentFormat.MARKDOWN 
      ? post.content 
      : null

    // Generate proper UUID format
    const ghostUuid = `${params.id.substring(0, 8)}-${params.id.substring(8, 12)}-${params.id.substring(12, 16)}-${params.id.substring(16, 20)}-${params.id.substring(20, 24)}000000000000`

    // Generate Lexical format with error handling
    let lexicalFormat: string | null = null;
    try {
      lexicalFormat = responseMarkdown ? convertMarkdownToLexical(responseMarkdown) : convertHtmlToLexical(responseHtml);
      console.log('👻 Lexical generation successful, length:', lexicalFormat?.length || 'NULL');
    } catch (error) {
      console.error('👻 Error generating Lexical format:', error);
      lexicalFormat = null;
    }

    // Format response in Ghost format with all required fields for editing
    const ghostResponse = {
      id: params.id,
      uuid: ghostUuid,
      title: post.title,
      slug: post.slug,
      html: responseHtml,
      lexical: lexicalFormat,
      mobiledoc: null,
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
          id: '1',
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
      url: post.isPublished 
        ? `${request.nextUrl.origin}/${fullBlog.user.slug || 'blog'}/${fullBlog.slug}/${post.slug}`
        : `${request.nextUrl.origin}/p/${params.id}`,
      excerpt: post.excerpt || '',
      reading_time: Math.max(1, Math.round((post.content?.length || 0) / 265)),
      access: true,
      send_email_when_published: false,
      email_segment: 'all',
      status: post.isPublished ? 'published' : 'draft',
      // Critical fields for Ghost API compatibility
      meta_title: null,
      meta_description: null,
      og_image: null,
      og_title: null,
      og_description: null,
      twitter_image: null,
      twitter_title: null,
      twitter_description: null,
      email_subject: null,
      frontmatter: null,
      feature_image_alt: null,
      feature_image_caption: null,
      // Additional fields that Ghost includes for editing
      email_only: false,
      newsletter_id: null,
      show_title_and_feature_image: true,
      type: 'post'
    }

    console.log('👻 Returning individual post:', post.title)
    console.log('👻 Ghost response lexical length:', ghostResponse.lexical?.length || 'NULL')
    console.log('👻 About to send response with lexical format')
    console.log('👻 Ghost response status:', ghostResponse.status)
    
    console.log('👻 ABOUT TO SEND RESPONSE TO ULYSSES')
    console.log('👻 GET: URL being returned:', ghostResponse.url)
    console.log('👻 GET: Post status being returned:', ghostResponse.status)

    return NextResponse.json({
      posts: [ghostResponse]
    }, {
      headers: {
        'Allow': 'GET, PUT, DELETE',
        'Content-Type': 'application/json',
        'X-Ghost-Version': '5.0.0'
      }
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
  // Log immediately to confirm the handler is reached
  console.log('🚨 PUT HANDLER REACHED - timestamp:', new Date().toISOString())
  
  const params = await context.params
  console.log('👻 PUT /api/ghost/admin/posts/[id] handler called for ID:', params.id)
  console.log('👻 PUT request headers:', Object.fromEntries(request.headers.entries()))
  console.log('👻 PUT request URL:', request.url)
  console.log('👻 PUT request method:', request.method)
  console.log('👻 PUT request body available:', request.body ? 'YES' : 'NO')
  console.log('👻 PUT content-length header:', request.headers.get('content-length') || 'NOT SET')
  
  try {
    console.log('👻 PUT: Starting request processing...')
    
    // Check if we can read the body size before parsing
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024)
      console.log(`👻 PUT: Request size: ${contentLength} bytes (${sizeInMB.toFixed(2)} MB)`)
      
      // Reject if approaching Vercel's 4.5MB limit to provide clear error
      if (sizeInMB > 4) {
        console.error(`👻 PUT: Request too large (${sizeInMB.toFixed(2)} MB) - Vercel limit is 4.5MB`)
        return NextResponse.json(
          { errors: [{ 
            message: `Request too large (${sizeInMB.toFixed(2)} MB). Maximum size is 4.5MB. Try reducing image sizes or content length.`,
            type: 'PayloadTooLargeError'
          }] },
          { status: 413 }
        )
      }
      
      if (sizeInMB > 3) {
        console.warn(`👻 PUT: Large request detected (${sizeInMB.toFixed(2)} MB) - approaching Vercel 4.5MB limit`)
      }
    }
    
    // Accept-Version header is optional - Ulysses doesn't always send it
    const acceptVersion = request.headers.get('accept-version')
    console.log('👻 PUT: Accept-Version header:', acceptVersion || 'not provided')

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
    console.log('👻 PUT: About to parse request body...')
    let body: GhostPostRequest
    try {
      body = await request.json()
      console.log('👻 PUT: Request body parsed successfully, posts count:', body.posts?.length)
      console.log('👻 PUT: First post title:', body.posts?.[0]?.title || 'No title')
      console.log('👻 PUT: First post content length:', body.posts?.[0]?.markdown?.length || body.posts?.[0]?.html?.length || 0)
      // Don't log full body for large requests to avoid log spam
      if (contentLength && parseInt(contentLength) > 100000) {
        console.log('👻 PUT: Large request body - skipping full log')
      } else {
        console.log('👻 PUT: Request body:', JSON.stringify(body, null, 2))
      }
    } catch (parseError) {
      console.error('👻 PUT: Failed to parse request body:', parseError)
      console.error('👻 PUT: Parse error type:', parseError instanceof Error ? parseError.constructor.name : typeof parseError)
      console.error('👻 PUT: Parse error message:', parseError instanceof Error ? parseError.message : String(parseError))
      
      return NextResponse.json(
        { errors: [{ message: `Failed to parse request body: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` }] },
        { status: 400 }
      )
    }
    
    if (!body.posts || !Array.isArray(body.posts) || body.posts.length === 0) {
      console.log('👻 PUT: Invalid request format - no posts array')
      return NextResponse.json(
        { errors: [{ message: 'Invalid request format. Expected posts array.' }] },
        { status: 400 }
      )
    }

    const ghostPost = body.posts[0] // Update first post in array
    console.log('👻 PUT: Processing post update for title:', ghostPost.title)

    // Find the existing post
    console.log('👻 PUT: Finding existing post with ID:', params.id)
    const existingPost = await prisma.post.findFirst({
      where: {
        ghostPostId: params.id,
        blogId: fullBlog.id,
        contentSource: ContentSource.GHOST
      }
    })
    console.log('👻 PUT: Found existing post:', existingPost ? existingPost.title : 'NOT FOUND')

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
    // Ghost CMS preserves published_at timestamp when unpublishing (unlike our previous implementation)
    const publishedAt = isPublished 
      ? (ghostPost.published_at ? new Date(ghostPost.published_at) : new Date())
      : existingPost.publishedAt // Preserve original timestamp when unpublishing
    
    // Debug publication status changes
    console.log('👻 PUT: Publication status analysis:')
    console.log('  - Incoming status:', ghostPost.status)
    console.log('  - Previous isPublished:', existingPost.isPublished)
    console.log('  - New isPublished:', isPublished)
    console.log('  - Previous publishedAt:', existingPost.publishedAt)
    console.log('  - New publishedAt:', publishedAt)
    console.log('  - Ghost CMS behavior: Published timestamp preserved on unpublish')
    
    if (existingPost.isPublished !== isPublished) {
      if (isPublished) {
        console.log('🟢 POST IS BEING PUBLISHED (draft → published)')
      } else {
        console.log('🔴 POST IS BEING UNPUBLISHED (published → draft) - preserving published_at timestamp')
      }
    } else {
      console.log('📝 POST STATUS UNCHANGED (' + (isPublished ? 'published' : 'draft') + ')')
    }

    // Configure marked to NOT wrap images in figure tags to prevent nesting
    const renderer = new marked.Renderer()
    renderer.image = function({ href, title, text }) {
      return `<img src="${href}" alt="${text || ''}"${title ? ` title="${title}"` : ''} />`
    }
    
    // Process content with unified image handling
    const contentProcessor = new ContentProcessor()
    let processingResult
    
    if (isMarkdownContent) {
      // For Markdown content with images already uploaded, skip image processing
      // Just validate the content and count images without downloading
      console.log('👻 PUT: Skipping image processing for Markdown content (images already uploaded)')
      const htmlContent = await marked(content, { renderer })
      const imageCount = (htmlContent.match(/<img[^>]+>/g) || []).length
      processingResult = {
        processedContent: content, // Store original Markdown
        imageCount,
        errors: []
      }
    } else {
      processingResult = await contentProcessor.processGhostContent(content, existingPost.id, fullBlog.showCameraMake)
    }
    
    // Generate excerpt from content (use HTML version for excerpt generation)
    const htmlForExcerpt = isMarkdownContent ? await marked(content, { renderer }) : content
    const excerpt = ghostPost.excerpt || contentProcessor.generateExcerpt(htmlForExcerpt)

    // Update the post
    console.log('👻 PUT: Updating post in database...')
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
    console.log('👻 PUT: Post updated successfully in database')
    console.log('👻 PUT: Database update confirmation:')
    console.log('  - Final isPublished in DB:', updatedPost.isPublished)
    console.log('  - Final publishedAt in DB:', updatedPost.publishedAt)
    console.log('  - Final status for response:', updatedPost.isPublished ? 'published' : 'draft')

    // Log image processing results
    if (processingResult.imageCount > 0) {
      console.log(`Processed ${processingResult.imageCount} images for updated Ghost post "${ghostPost.title}"`)
    }
    if (processingResult.errors.length > 0) {
      console.warn(`Image processing errors for updated Ghost post ${updatedPost.id}:`, processingResult.errors)
    }

    // Convert content for response
    const responseHtml = updatedPost.contentFormat === ContentFormat.MARKDOWN 
      ? await marked(updatedPost.content, { renderer }) 
      : updatedPost.content
    const responseMarkdown = updatedPost.contentFormat === ContentFormat.MARKDOWN 
      ? updatedPost.content 
      : null

    // Generate proper UUID format
    const ghostUuid = `${params.id.substring(0, 8)}-${params.id.substring(8, 12)}-${params.id.substring(12, 16)}-${params.id.substring(16, 20)}-${params.id.substring(20, 24)}000000000000`

    // Format response in Ghost format with all required fields for editing
    const ghostResponse = {
      id: params.id,
      uuid: ghostUuid,
      title: updatedPost.title,
      slug: updatedPost.slug,
      html: responseHtml,
      lexical: responseMarkdown ? convertMarkdownToLexical(responseMarkdown) : convertHtmlToLexical(responseHtml),
      mobiledoc: null,
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
          id: '1',
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
      url: (() => {
        const url = updatedPost.isPublished 
          ? `${request.nextUrl.origin}/${fullBlog.user.slug || 'blog'}/${fullBlog.slug}/${updatedPost.slug}`
          : `${request.nextUrl.origin}/p/${params.id}`
        console.log('👻 PUT: Generated URL for response:', url)
        return url
      })(),
      excerpt: updatedPost.excerpt || '',
      reading_time: Math.max(1, Math.round((updatedPost.content?.length || 0) / 265)),
      access: true,
      send_email_when_published: false,
      email_segment: 'all',
      status: updatedPost.isPublished ? 'published' : 'draft',
      // Critical fields for Ghost API compatibility
      meta_title: null,
      meta_description: null,
      og_image: null,
      og_title: null,
      og_description: null,
      twitter_image: null,
      twitter_title: null,
      twitter_description: null,
      email_subject: null,
      frontmatter: null,
      feature_image_alt: null,
      feature_image_caption: null,
      // Additional fields that Ghost includes for editing
      email_only: false,
      newsletter_id: null,
      show_title_and_feature_image: true,
      type: 'post'
    }

    console.log('👻 Successfully updated post:', updatedPost.title)
    console.log('👻 PUT: Final URL being returned:', ghostResponse.url)
    console.log('👻 PUT: Final status being returned:', ghostResponse.status)
    console.log('👻 PUT: Sending successful response')

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
    console.error('👻 PUT: Full error details:', JSON.stringify(error, null, 2))
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}

// Lexical node types
interface LexicalTextNode {
  type: 'text';
  text: string;
  detail: number;
  format: number;
  mode: string;
  style: string;
  version: number;
}

interface LexicalParagraphNode {
  type: 'paragraph';
  children: LexicalTextNode[];
  direction: string;
  format: string;
  indent: number;
  version: number;
}

interface LexicalImageNode {
  type: 'image';
  version: number;
  src: string;
  width: number;
  height: number;
  title: string;
  alt: string;
  caption: string;
  cardWidth: string;
  href: string;
}

type LexicalNode = LexicalParagraphNode | LexicalImageNode;

/**
 * Convert HTML to Ghost Lexical format
 */
function convertHtmlToLexical(html: string): string | null {
  if (!html) return null;
  
  try {
    const children: LexicalNode[] = [];
    
    // Simple HTML parsing - split by <p> tags and handle images
    const paragraphs = html.split(/<\/?p[^>]*>/i).filter(p => p.trim());
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;
      
      // Check if this paragraph contains an image
      const imageMatch = trimmedParagraph.match(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/i);
      if (imageMatch) {
        // Add Ghost Lexical image node (real format)
        children.push({
          type: 'image',
          version: 1,
          src: imageMatch[1],
          width: 800, // Default width
          height: 600, // Default height  
          title: '',
          alt: imageMatch[2] || '',
          caption: '',
          cardWidth: 'regular',
          href: ''
        });
        
        // Handle any text around the image
        const textWithoutImage = trimmedParagraph.replace(/<img[^>]*>/i, '').trim();
        if (textWithoutImage) {
          children.push({
            type: 'paragraph',
            children: [{
              type: 'text',
              text: textWithoutImage.replace(/<[^>]*>/g, ''), // Remove any remaining HTML tags
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1
            }],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1
          });
        }
      } else {
        // Regular text paragraph
        const textContent = trimmedParagraph.replace(/<[^>]*>/g, '').trim(); // Remove HTML tags
        if (textContent) {
          children.push({
            type: 'paragraph',
            children: [{
              type: 'text',
              text: textContent,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1
            }],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1
          });
        }
      }
    }
    
    // If no children, add empty paragraph
    if (children.length === 0) {
      children.push({
        type: 'paragraph',
        children: [],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1
      });
    }
    
    const lexicalData = {
      root: {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1
      }
    };
    
    return JSON.stringify(lexicalData);
  } catch (error) {
    console.error('Error converting HTML to lexical:', error);
    return null;
  }
}

/**
 * Convert Markdown to Ghost Lexical format
 */
function convertMarkdownToLexical(markdown: string): string | null {
  if (!markdown) return null;
  
  try {
    const children: LexicalNode[] = [];
    const lines = markdown.split('\n');
    let currentParagraphText = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Handle images
      const imageMatch = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)(.*)$/);
      if (imageMatch) {
        // Finish any pending paragraph
        if (currentParagraphText.trim()) {
          children.push({
            type: 'paragraph',
            children: [{
              type: 'text',
              text: currentParagraphText.trim(),
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1
            }],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1
          });
          currentParagraphText = '';
        }
        
        // Add Ghost Lexical image node (real format)
        children.push({
          type: 'image',
          version: 1,
          src: imageMatch[2],
          width: 800, // Default width
          height: 600, // Default height
          title: '',
          alt: imageMatch[1] || '',
          caption: '',
          cardWidth: 'regular',
          href: ''
        });
        
        // Continue with any text after the image
        if (imageMatch[3].trim()) {
          currentParagraphText += imageMatch[3].trim() + ' ';
        }
        continue;
      }
      
      // Handle regular text lines
      if (trimmedLine) {
        currentParagraphText += trimmedLine + ' ';
      } else if (currentParagraphText.trim()) {
        // Empty line - finish paragraph
        children.push({
          type: 'paragraph',
          children: [{
            type: 'text',
            text: currentParagraphText.trim(),
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1
          }],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1
        });
        currentParagraphText = '';
      }
    }
    
    // Add final paragraph if exists
    if (currentParagraphText.trim()) {
      children.push({
        type: 'paragraph',
        children: [{
          type: 'text',
          text: currentParagraphText.trim(),
          detail: 0,
          format: 0,
          mode: 'normal',
          style: '',
          version: 1
        }],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1
      });
    }
    
    // If no children, add empty paragraph
    if (children.length === 0) {
      children.push({
        type: 'paragraph',
        children: [],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1
      });
    }
    
    const lexicalData = {
      root: {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1
      }
    };
    
    return JSON.stringify(lexicalData);
  } catch (error) {
    console.error('Error converting markdown to lexical:', error);
    return null;
  }
}

/**
 * OPTIONS /api/ghost/admin/posts/{id} - Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  console.log('👻 OPTIONS /api/ghost/admin/posts/[id] handler called')
  console.log('👻 OPTIONS request headers:', Object.fromEntries(request.headers.entries()))
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Version',
      'Content-Type': 'application/json',
      'X-Ghost-Version': '5.0.0'
    }
  })
}