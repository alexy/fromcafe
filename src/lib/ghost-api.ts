/**
 * Ghost Admin API client for fetching and managing Ghost posts
 */

import GhostAdminAPI from '@tryghost/admin-api'

export interface GhostPost {
  id: string
  uuid: string
  title: string
  slug: string
  html: string
  plaintext: string
  excerpt: string
  status: 'published' | 'draft' | 'scheduled'
  visibility: 'public' | 'members' | 'paid'
  created_at: string
  updated_at: string
  published_at: string | null
  url: string
  reading_time: number
  authors: Array<{
    id: string
    name: string
    slug: string
  }>
  tags: Array<{
    id: string
    name: string
    slug: string
  }>
}

export interface GhostApiConfig {
  url: string
  token: string
  version?: string
}

export class GhostApiClient {
  private client: GhostAdminAPI

  constructor(config: GhostApiConfig) {
    this.client = new GhostAdminAPI({
      url: config.url,
      key: config.token, // Ghost Admin API expects 'key' parameter for staff tokens
      version: config.version || 'v5.0'
    })
  }

  /**
   * Fetch all published posts from Ghost
   */
  async fetchPosts(): Promise<GhostPost[]> {
    try {
      const posts = await this.client.posts.browse({
        include: ['authors', 'tags'],
        filter: 'status:published',
        order: 'published_at DESC',
        limit: 'all'
      })
      return posts as GhostPost[]
    } catch (error) {
      console.error('Error fetching Ghost posts:', error)
      throw new Error(`Failed to fetch Ghost posts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch a specific post by ID
   */
  async fetchPost(postId: string): Promise<GhostPost | null> {
    try {
      const post = await this.client.posts.read({
        id: postId
      }, {
        include: ['authors', 'tags']
      })
      return post as GhostPost
    } catch (error) {
      console.error(`Error fetching Ghost post ${postId}:`, error)
      return null
    }
  }

  /**
   * Fetch posts updated since a specific date
   */
  async fetchPostsUpdatedSince(since: Date): Promise<GhostPost[]> {
    try {
      const isoDate = since.toISOString()
      const posts = await this.client.posts.browse({
        include: ['authors', 'tags'],
        filter: `status:published+updated_at:>'${isoDate}'`,
        order: 'updated_at DESC',
        limit: 'all'
      })
      return posts as GhostPost[]
    } catch (error) {
      console.error('Error fetching updated Ghost posts:', error)
      throw new Error(`Failed to fetch updated Ghost posts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Test the connection to Ghost API
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to fetch a single post to test the connection
      await this.client.posts.browse({
        limit: 1
      })
      return true
    } catch (error) {
      console.error('Ghost API connection test failed:', error)
      return false
    }
  }

  /**
   * Get site information
   */
  async getSiteInfo(): Promise<{ title: string; description: string; url: string } | null> {
    try {
      const site = await this.client.site.read()
      return {
        title: site.title || '',
        description: site.description || '',
        url: site.url || ''
      }
    } catch (error) {
      console.error('Error fetching Ghost site info:', error)
      return null
    }
  }
}

/**
 * Create a Ghost API client instance
 */
export function createGhostClient(config: GhostApiConfig): GhostApiClient {
  return new GhostApiClient(config)
}

/**
 * Validate Ghost API configuration
 */
export function validateGhostConfig(config: Partial<GhostApiConfig>): config is GhostApiConfig {
  return !!(config.url && config.token)
}

/**
 * Validate Ghost site URL format
 */
export function validateGhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}