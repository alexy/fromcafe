import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentSource, ContentFormat } from '@prisma/client'
import { marked } from 'marked'
import { validateGhostAuth } from '@/lib/ghost-auth'
import { ContentProcessor } from '@/lib/content-processor'
import { 
  processGhostContent, 
  createMarkdownRenderer, 
  type GhostPostRequest 
} from '@/lib/ghost-content-processor'
import { generateSlug, ensureUniqueSlug } from '@/lib/ghost-utils'

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
    console.log('👻 DB CONTENT DEBUG:')
    try {
      console.log('👻 Post content length:', post.content?.length || 0)
      console.log('👻 Post content format:', post.contentFormat)
      console.log('👻 Post content has img tags:', post.content?.includes('<img') || false)
      console.log('👻 Post content has markdown images:', post.content?.includes('![') || false)
      if (post.content && post.content.length > 0) {
        // Safely log content preview without breaking on special characters
        const safePreview = post.content.substring(0, 200).replace(/[\r\n\t]/g, ' ')
        console.log('👻 Post content preview (safe):', JSON.stringify(safePreview))
      }
    } catch (debugError) {
      console.error('👻 Error in content debugging:', debugError)
    }

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
    
    // Debug: Always log what content we're processing
    console.log('👻 CONTENT DEBUG - Processing content:');
    console.log('👻 responseHtml length:', responseHtml?.length || 0);
    console.log('👻 responseMarkdown length:', responseMarkdown?.length || 0);
    console.log('👻 responseHtml preview:', responseHtml?.substring(0, 200) || 'NULL');
    console.log('👻 responseMarkdown preview:', responseMarkdown?.substring(0, 200) || 'NULL');
    console.log('👻 HTML has images:', responseHtml?.includes('<img') || false);
    console.log('👻 Markdown has images:', responseMarkdown?.includes('![') || false);
    
    try {
      lexicalFormat = responseMarkdown ? convertMarkdownToLexical(responseMarkdown) : convertHtmlToLexical(responseHtml);
      console.log('👻 Lexical generation successful, length:', lexicalFormat?.length || 'NULL');
      
      // Debug: Log the actual Lexical content to compare with real Ghost
      if (lexicalFormat && (responseHtml.includes('<img') || (responseMarkdown && responseMarkdown.includes('![')))) {
        console.log('👻 POST HAS IMAGES - Lexical content:');
        console.log(lexicalFormat);
        try {
          const parsed = JSON.parse(lexicalFormat);
          console.log('👻 Lexical parsed structure:');
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.error('👻 Failed to parse generated Lexical:', e);
        }
      }
    } catch (error) {
      console.error('👻 Error generating Lexical format:', error);
      lexicalFormat = null;
    }

    // Format response in Ghost format matching real Ghost exactly
    const ghostResponse = {
      id: params.id,
      uuid: ghostUuid,
      title: post.title,
      slug: post.slug,
      mobiledoc: null,
      lexical: lexicalFormat,
      comment_id: params.id,
      feature_image: null,
      featured: false,
      status: post.isPublished ? 'published' : 'draft',
      visibility: 'public',
      created_at: post.createdAt.toISOString(),
      updated_at: post.updatedAt.toISOString(),
      published_at: post.publishedAt?.toISOString() || null,
      custom_excerpt: post.excerpt || null,
      codeinjection_head: null,
      codeinjection_foot: null,
      custom_template: null,
      canonical_url: null,
      tags: [],
      tiers: [
        {
          id: 'free',
          name: 'Free',
          slug: 'free',
          active: true,
          welcome_page_url: null,
          visibility: 'public',
          trial_days: 0,
          description: null,
          type: 'free',
          currency: null,
          monthly_price: null,
          yearly_price: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          monthly_price_id: null,
          yearly_price_id: null
        }
      ],
      authors: [{
        id: tokenData.userId,
        name: 'Author',
        slug: 'author',
        email: 'admin@example.com',
        profile_image: null,
        cover_image: null,
        bio: null,
        website: null,
        location: null,
        facebook: null,
        twitter: null,
        threads: null,
        bluesky: null,
        mastodon: null,
        tiktok: null,
        youtube: null,
        instagram: null,
        linkedin: null,
        accessibility: null,
        status: 'active',
        meta_title: null,
        meta_description: null,
        tour: null,
        last_seen: new Date().toISOString(),
        comment_notifications: true,
        free_member_signup_notification: true,
        paid_subscription_started_notification: true,
        paid_subscription_canceled_notification: false,
        mention_notifications: true,
        recommendation_notifications: true,
        milestone_notifications: true,
        donation_notifications: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        roles: [{
          id: '1',
          name: 'Owner',
          description: 'Blog Owner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }],
        url: `${request.nextUrl.origin}/author/author/`
      }],
      count: {
        clicks: 0,
        positive_feedback: 0,
        negative_feedback: 0
      },
      primary_author: {
        id: tokenData.userId,
        name: 'Author',
        slug: 'author',
        email: 'admin@example.com',
        profile_image: null,
        cover_image: null,
        bio: null,
        website: null,
        location: null,
        facebook: null,
        twitter: null,
        threads: null,
        bluesky: null,
        mastodon: null,
        tiktok: null,
        youtube: null,
        instagram: null,
        linkedin: null,
        accessibility: null,
        status: 'active',
        meta_title: null,
        meta_description: null,
        tour: null,
        last_seen: new Date().toISOString(),
        comment_notifications: true,
        free_member_signup_notification: true,
        paid_subscription_started_notification: true,
        paid_subscription_canceled_notification: false,
        mention_notifications: true,
        recommendation_notifications: true,
        milestone_notifications: true,
        donation_notifications: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        roles: [{
          id: '1',
          name: 'Owner',
          description: 'Blog Owner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }],
        url: `${request.nextUrl.origin}/author/author/`
      },
      primary_tag: null,
      email_segment: 'all',
      url: post.isPublished 
        ? `${request.nextUrl.origin}/${fullBlog.user.slug || 'blog'}/${fullBlog.slug}/${post.slug}`
        : `${request.nextUrl.origin}/p/${params.id}`,
      excerpt: post.excerpt || '',
      reading_time: Math.max(0, Math.round((post.content?.length || 0) / 265)),
      og_image: null,
      og_title: null,
      og_description: null,
      twitter_image: null,
      twitter_title: null,
      twitter_description: null,
      meta_title: null,
      meta_description: null,
      email_subject: null,
      frontmatter: null,
      feature_image_alt: null,
      feature_image_caption: null,
      email_only: false,
      email: null,
      newsletter: null
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

// Interfaces and utility functions are now imported from shared modules


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
    const source = searchParams.get('source') // ?source=html parameter
    
    console.log('👻 PUT: source parameter:', source || 'not provided')

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

    // Process content using shared logic
    const contentProcessingResult = await processGhostContent(ghostPost, source)
    const { content, isMarkdownContent, contentFormat } = contentProcessingResult

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

    // Use shared markdown renderer
    const renderer = createMarkdownRenderer()
    
    // Process content with unified image handling
    const contentProcessor = new ContentProcessor()
    let processingResult
    
    if (isMarkdownContent && source !== 'html') {
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
      // For HTML content (including when source=html is specified)
      processingResult = await contentProcessor.processGhostContent(content, existingPost.id, fullBlog.showCameraMake)
    }
    
    // Generate excerpt from content (use HTML version for excerpt generation)
    const htmlForExcerpt = (isMarkdownContent && source !== 'html') ? await marked(content, { renderer }) : content
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
        contentFormat,
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

    // Format response in Ghost format matching real Ghost exactly
    const ghostResponse = {
      id: params.id,
      uuid: ghostUuid,
      title: updatedPost.title,
      slug: updatedPost.slug,
      html: responseHtml,
      lexical: responseMarkdown ? convertMarkdownToLexical(responseMarkdown) : convertHtmlToLexical(responseHtml),
      mobiledoc: null,
      // markdown: responseMarkdown, // Real Ghost uses undefined, not null for missing markdown
      comment_id: updatedPost.id,
      plaintext: updatedPost.excerpt || '',
      feature_image: null,
      featured: false,
      visibility: 'public',
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
        // email: null, // Real Ghost doesn't include email field
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
      // reading_time: Math.max(1, Math.round((updatedPost.content?.length || 0) / 265)), // Real Ghost doesn't include this for editing
      // access: true, // Real Ghost doesn't include this for editing
      // send_email_when_published: false, // Real Ghost doesn't include this for editing
      email_segment: 'all',
      status: updatedPost.isPublished ? 'published' : 'draft',
      // Critical fields for Ghost API compatibility - match real Ghost exactly
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
      // Real Ghost fields - match exactly what real Ghost returns
      email_only: false
      // newsletter_id: null, // Real Ghost uses undefined, not null
      // show_title_and_feature_image: true, // Real Ghost doesn't include this field
      // type: 'post' // Real Ghost doesn't include type field for posts
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

// Lexical node types (matching real Ghost format exactly)
interface LexicalTextNode {
  type: 'extended-text';
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
  direction: null;
  format: string;
  indent: number;
  version: number;
}

interface LexicalHeadingNode {
  type: 'extended-heading';
  children: LexicalTextNode[];
  direction: null;
  format: string;
  indent: number;
  version: number;
  tag: string;
}

interface LexicalImageNode {
  type: 'image';
  version: number;
  src: string;
  width: number | null;
  height: number | null;
  title: string;
  alt: string;
  caption: string;
  cardWidth: string;
  href: string;
}

type LexicalNode = LexicalParagraphNode | LexicalHeadingNode | LexicalImageNode;

/**
 * Convert HTML to Ghost Lexical format
 */
function convertHtmlToLexical(html: string): string | null {
  if (!html) return null;
  
  try {
    const children: LexicalNode[] = [];
    
    // Parse HTML more carefully to handle headings and images
    let remainingHtml = html;
    
    // Extract headings first
    const headingMatches = [...remainingHtml.matchAll(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi)];
    for (const match of headingMatches) {
      const level = match[1];
      const content = match[2].replace(/<[^>]*>/g, '').trim();
      if (content) {
        children.push({
          type: 'extended-heading',
          children: [{
            type: 'extended-text',
            text: content,
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1
          }],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
          tag: `h${level}`
        });
      }
      remainingHtml = remainingHtml.replace(match[0], '');
    }
    
    // Extract standalone images (not in paragraphs)
    const standaloneImageMatches = [...remainingHtml.matchAll(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi)];
    for (const match of standaloneImageMatches) {
      children.push({
        type: 'image',
        version: 1,
        src: match[1],
        width: null,
        height: null,
        title: '',
        alt: match[2] || '',
        caption: '',
        cardWidth: 'regular',
        href: ''
      });
      remainingHtml = remainingHtml.replace(match[0], '');
    }
    
    // Parse remaining content as paragraphs
    const paragraphs = remainingHtml.split(/<\/?p[^>]*>/i).filter(p => p.trim());
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;
      
      // Check if this paragraph contains an image
      const imageMatch = trimmedParagraph.match(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/i);
      if (imageMatch) {
        // Add Ghost Lexical image node (real format)
        children.push({
          type: 'image',
          version: 1,
          src: imageMatch[1],
          width: null,
          height: null,
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
              type: 'extended-text',
              text: textWithoutImage.replace(/<[^>]*>/g, ''), // Remove any remaining HTML tags
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1
            }],
            direction: null,
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
              type: 'extended-text',
              text: textContent,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1
            }],
            direction: null,
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
        direction: null,
        format: '',
        indent: 0,
        version: 1
      });
    }
    
    const lexicalData = {
      root: {
        children,
        direction: null,
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
      
      // Handle headings
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // Finish any pending paragraph
        if (currentParagraphText.trim()) {
          children.push({
            type: 'paragraph',
            children: [{
              type: 'extended-text',
              text: currentParagraphText.trim(),
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1
            }],
            direction: null,
            format: '',
            indent: 0,
            version: 1
          });
          currentParagraphText = '';
        }
        
        // Add heading
        const level = headingMatch[1].length;
        children.push({
          type: 'extended-heading',
          children: [{
            type: 'extended-text',
            text: headingMatch[2],
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1
          }],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
          tag: `h${level}`
        });
        continue;
      }
      
      // Handle images
      const imageMatch = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)(.*)$/);
      if (imageMatch) {
        // Finish any pending paragraph
        if (currentParagraphText.trim()) {
          children.push({
            type: 'paragraph',
            children: [{
              type: 'extended-text',
              text: currentParagraphText.trim(),
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1
            }],
            direction: null,
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
          width: null,
          height: null,
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
            type: 'extended-text',
            text: currentParagraphText.trim(),
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1
          }],
          direction: null,
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
          type: 'extended-text',
          text: currentParagraphText.trim(),
          detail: 0,
          format: 0,
          mode: 'normal',
          style: '',
          version: 1
        }],
        direction: null,
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
        direction: null,
        format: '',
        indent: 0,
        version: 1
      });
    }
    
    const lexicalData = {
      root: {
        children,
        direction: null,
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