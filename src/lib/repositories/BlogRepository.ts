import { prisma } from '@/lib/prisma'
import { Blog, Prisma } from '@prisma/client'

export type BlogWithUser = Blog & {
  user: {
    id: string
    slug: string | null
    displayName: string | null
  }
}

export type BlogWithPosts = BlogWithUser & {
  posts: Array<{
    id: string
    title: string
    content: string
    excerpt: string | null
    slug: string
    isPublished: boolean
    publishedAt: Date | null
    createdAt: Date
    updatedAt: Date
    postTags: Array<{
      tag: {
        id: string
        name: string
        slug: string
      }
    }>
  }>
}

export interface BlogQuery {
  // For path-based blogs
  userSlug?: string
  blogSlug?: string
  // For subdomain blogs
  subdomain?: string
  // For custom domain blogs
  customDomain?: string
}

export class BlogRepository {
  /**
   * Find a blog by ID with ownership check
   */
  static async findByIdForUser(blogId: string, userId: string): Promise<BlogWithUser | null> {
    return prisma.blog.findFirst({
      where: {
        id: blogId,
        userId: userId
      },
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            displayName: true
          }
        }
      }
    })
  }

  /**
   * Find a blog by ID (admin access - no ownership check)
   */
  static async findById(blogId: string): Promise<BlogWithUser | null> {
    return prisma.blog.findUnique({
      where: { id: blogId },
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            displayName: true
          }
        }
      }
    })
  }

  /**
   * Find blog with query parameters (subdomain, custom domain, or path-based)
   */
  static async findByQuery(query: BlogQuery, tagSlug?: string): Promise<BlogWithPosts | null> {
    const whereClause: Prisma.BlogWhereInput = {
      isPublic: true
    }

    if (query.subdomain) {
      whereClause.subdomain = query.subdomain
      whereClause.urlFormat = 'subdomain'
    } else if (query.customDomain) {
      whereClause.customDomain = query.customDomain
      whereClause.urlFormat = 'custom'
    } else if (query.userSlug && query.blogSlug) {
      whereClause.slug = query.blogSlug
      whereClause.user = { slug: query.userSlug }
    } else {
      return null
    }

    const blog = await prisma.blog.findFirst({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            displayName: true
          }
        },
        posts: {
          where: {
            isPublished: true,
            ...(tagSlug && tagSlug !== 'all' ? {
              postTags: {
                some: {
                  tag: {
                    slug: tagSlug
                  }
                }
              }
            } : {})
          },
          orderBy: { publishedAt: 'desc' },
          include: {
            postTags: {
              include: {
                tag: true
              }
            }
          }
        }
      }
    })

    if (!blog || !blog.user) {
      return null
    }

    return blog as BlogWithPosts
  }

  /**
   * Find blog by subdomain
   */
  static async findBySubdomain(subdomain: string): Promise<BlogWithUser | null> {
    return prisma.blog.findFirst({
      where: {
        subdomain: subdomain,
        urlFormat: 'subdomain',
        isPublic: true
      },
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            displayName: true
          }
        }
      }
    })
  }

  /**
   * Find blog by custom domain
   */
  static async findByCustomDomain(domain: string): Promise<BlogWithUser | null> {
    return prisma.blog.findFirst({
      where: {
        customDomain: domain,
        urlFormat: 'custom',
        isPublic: true
      },
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            displayName: true
          }
        }
      }
    })
  }

  /**
   * Get all blogs for a user
   */
  static async findAllForUser(userId: string): Promise<BlogWithUser[]> {
    return prisma.blog.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            displayName: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
  }

  /**
   * Create a new blog
   */
  static async create(data: Prisma.BlogCreateInput): Promise<BlogWithUser> {
    return prisma.blog.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            displayName: true
          }
        }
      }
    })
  }

  /**
   * Update a blog
   */
  static async update(
    blogId: string,
    data: Prisma.BlogUpdateInput,
    userId?: string
  ): Promise<BlogWithUser | null> {
    const whereClause: Prisma.BlogWhereUniqueInput = { id: blogId }
    
    // If userId provided, ensure ownership
    if (userId) {
      const blog = await prisma.blog.findFirst({
        where: { id: blogId, userId }
      })
      if (!blog) return null
    }

    return prisma.blog.update({
      where: whereClause,
      data,
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            displayName: true
          }
        }
      }
    })
  }

  /**
   * Delete a blog
   */
  static async delete(blogId: string, userId?: string): Promise<boolean> {
    try {
      // If userId provided, ensure ownership
      if (userId) {
        const blog = await prisma.blog.findFirst({
          where: { id: blogId, userId }
        })
        if (!blog) return false
      }

      await prisma.blog.delete({
        where: { id: blogId }
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if slug is available for user
   */
  static async isSlugAvailable(slug: string, userId: string, excludeBlogId?: string): Promise<boolean> {
    const existingBlog = await prisma.blog.findFirst({
      where: {
        slug,
        userId,
        ...(excludeBlogId && { id: { not: excludeBlogId } })
      }
    })
    return !existingBlog
  }

  /**
   * Check if subdomain is available
   */
  static async isSubdomainAvailable(subdomain: string, excludeBlogId?: string): Promise<boolean> {
    const existingBlog = await prisma.blog.findFirst({
      where: {
        subdomain,
        ...(excludeBlogId && { id: { not: excludeBlogId } })
      }
    })
    return !existingBlog
  }

  /**
   * Check if custom domain is available
   */
  static async isCustomDomainAvailable(domain: string, excludeBlogId?: string): Promise<boolean> {
    const existingBlog = await prisma.blog.findFirst({
      where: {
        customDomain: domain,
        ...(excludeBlogId && { id: { not: excludeBlogId } })
      }
    })
    return !existingBlog
  }

  /**
   * Update last sync timestamp
   */
  static async updateLastSynced(blogId: string, updateCount?: number): Promise<void> {
    await prisma.blog.update({
      where: { id: blogId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncAttemptAt: new Date(),
        ...(updateCount !== undefined && { lastSyncUpdateCount: updateCount })
      }
    })
  }

  /**
   * Get blogs that need syncing (for cron jobs)
   */
  static async findBlogsForSync(): Promise<BlogWithUser[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    return prisma.blog.findMany({
      where: {
        user: {
          isActive: true,
          evernoteToken: { not: null }
        },
        OR: [
          { lastSyncedAt: null },
          { lastSyncedAt: { lt: oneHourAgo } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            displayName: true
          }
        }
      }
    })
  }
}