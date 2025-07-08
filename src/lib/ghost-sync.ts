/**
 * Ghost API sync functionality for importing posts
 */

import { prisma } from '@/lib/prisma'
import { createGhostClient, GhostPost, validateGhostConfig } from '@/lib/ghost-api'
import { ContentSource } from '@prisma/client'

export interface GhostSyncResult {
  success: boolean
  newPosts: number
  updatedPosts: number
  publishedPosts: number
  unpublishedPosts: number
  errors: string[]
  lastSyncedAt: Date
}

export interface GhostSyncOptions {
  blogId: string
  ghostSiteUrl: string
  ghostApiToken: string
  forceFullSync?: boolean
}

/**
 * Sync posts from Ghost to a blog
 */
export async function syncGhostPosts(options: GhostSyncOptions): Promise<GhostSyncResult> {
  const result: GhostSyncResult = {
    success: false,
    newPosts: 0,
    updatedPosts: 0,
    publishedPosts: 0,
    unpublishedPosts: 0,
    errors: [],
    lastSyncedAt: new Date()
  }

  try {
    // Validate Ghost configuration
    if (!validateGhostConfig({ url: options.ghostSiteUrl, token: options.ghostApiToken })) {
      result.errors.push('Invalid Ghost API configuration')
      return result
    }

    // Get the blog
    const blog = await prisma.blog.findUnique({
      where: { id: options.blogId },
      include: { user: true }
    })

    if (!blog) {
      result.errors.push('Blog not found')
      return result
    }

    // Create Ghost API client
    const ghostClient = createGhostClient({
      url: options.ghostSiteUrl,
      token: options.ghostApiToken
    })

    // Test connection
    const connectionValid = await ghostClient.testConnection()
    if (!connectionValid) {
      result.errors.push('Failed to connect to Ghost API')
      return result
    }

    // Determine which posts to fetch
    let ghostPosts: GhostPost[]
    
    if (options.forceFullSync || !blog.ghostLastSyncedAt) {
      // Full sync - fetch all posts
      console.log('Performing full Ghost sync...')
      ghostPosts = await ghostClient.fetchPosts()
    } else {
      // Incremental sync - fetch posts updated since last sync
      console.log('Performing incremental Ghost sync...')
      ghostPosts = await ghostClient.fetchPostsUpdatedSince(blog.ghostLastSyncedAt)
    }

    console.log(`Found ${ghostPosts.length} Ghost posts to process`)

    // Process each Ghost post
    for (const ghostPost of ghostPosts) {
      try {
        await processGhostPost(ghostPost, blog.id, result)
      } catch (error) {
        console.error(`Error processing Ghost post ${ghostPost.id}:`, error)
        result.errors.push(`Failed to process post "${ghostPost.title}": ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Update blog's last sync timestamp
    await prisma.blog.update({
      where: { id: options.blogId },
      data: {
        ghostLastSyncedAt: result.lastSyncedAt,
        lastSyncedAt: result.lastSyncedAt,
        lastSyncAttemptAt: result.lastSyncedAt,
        lastSyncUpdateCount: result.newPosts + result.updatedPosts
      }
    })

    result.success = result.errors.length === 0
    console.log(`Ghost sync completed: ${result.newPosts} new, ${result.updatedPosts} updated, ${result.publishedPosts} published, ${result.unpublishedPosts} unpublished, ${result.errors.length} errors`)

  } catch (error) {
    console.error('Ghost sync failed:', error)
    result.errors.push(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

/**
 * Process a single Ghost post
 */
async function processGhostPost(ghostPost: GhostPost, blogId: string, result: GhostSyncResult): Promise<void> {
  // Process all post statuses: published, draft, and scheduled
  console.log(`Processing Ghost post: ${ghostPost.title} (status: ${ghostPost.status})`)

  // Check if post already exists
  const existingPost = await prisma.post.findFirst({
    where: {
      blogId,
      ghostPostId: ghostPost.id
    }
  })

  // Generate unique slug
  const slug = await generateUniqueSlug(ghostPost.slug, blogId, existingPost?.id)
  
  // Determine publication status based on Ghost status
  const isPublished = ghostPost.status === 'published'
  const publishedAt = ghostPost.status === 'published' && ghostPost.published_at 
    ? new Date(ghostPost.published_at) 
    : ghostPost.status === 'published' 
      ? new Date(ghostPost.created_at)
      : null
  
  const postData = {
    title: ghostPost.title,
    content: ghostPost.html || ghostPost.plaintext || '',
    excerpt: ghostPost.excerpt || null,
    slug,
    isPublished,
    publishedAt,
    contentSource: ContentSource.GHOST,
    ghostPostId: ghostPost.id,
    sourceUpdatedAt: new Date(ghostPost.updated_at),
    sourceUrl: ghostPost.url
  }

  if (existingPost) {
    // Update existing post if it has been modified
    const sourceUpdated = new Date(ghostPost.updated_at)
    const lastUpdated = existingPost.sourceUpdatedAt || existingPost.updatedAt
    const statusChanged = existingPost.isPublished !== isPublished

    if (sourceUpdated > lastUpdated || statusChanged) {
      await prisma.post.update({
        where: { id: existingPost.id },
        data: postData
      })
      result.updatedPosts++
      
      // Track publication status changes
      if (statusChanged) {
        if (isPublished && !existingPost.isPublished) {
          result.publishedPosts++
          console.log(`Published post: ${ghostPost.title} (draft → published)`)
        } else if (!isPublished && existingPost.isPublished) {
          result.unpublishedPosts++
          console.log(`Unpublished post: ${ghostPost.title} (published → draft)`)
        }
      } else {
        console.log(`Updated post: ${ghostPost.title}`)
      }
    }
  } else {
    // Create new post
    await prisma.post.create({
      data: {
        ...postData,
        blogId
      }
    })
    result.newPosts++
    console.log(`Created new post: ${ghostPost.title} (status: ${ghostPost.status})`)
  }
}

/**
 * Generate a unique slug for a post within a blog
 */
async function generateUniqueSlug(baseSlug: string, blogId: string, excludePostId?: string): Promise<string> {
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
 * Test Ghost API connection
 */
export async function testGhostConnection(ghostSiteUrl: string, ghostApiToken: string): Promise<{
  success: boolean
  error?: string
  siteInfo?: { title: string; description: string; url: string }
}> {
  try {
    if (!validateGhostConfig({ url: ghostSiteUrl, token: ghostApiToken })) {
      return { success: false, error: 'Invalid Ghost API configuration' }
    }

    const ghostClient = createGhostClient({
      url: ghostSiteUrl,
      token: ghostApiToken
    })

    const connectionValid = await ghostClient.testConnection()
    if (!connectionValid) {
      return { success: false, error: 'Failed to connect to Ghost API' }
    }

    const siteInfo = await ghostClient.getSiteInfo()
    return { 
      success: true, 
      siteInfo: siteInfo || undefined
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}