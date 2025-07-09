import { prisma } from '@/lib/prisma'
import { Post, Prisma, ContentSource, ContentFormat } from '@prisma/client'

export type PostWithBlog = Post & {
  blog: {
    id: string
    title: string
    slug: string
    author: string | null
    customDomain: string | null
    theme: string
    isPublic: boolean
    createdAt: Date
    updatedAt: Date
    user: {
      id: string
      slug: string | null
      displayName: string | null
    }
  }
  postTags: Array<{
    tag: {
      id: string
      name: string
      slug: string
    }
  }>
}

export type PostWithTags = Post & {
  postTags: Array<{
    tag: {
      id: string
      name: string
      slug: string
    }
  }>
}

export interface PostQuery {
  // For path-based blogs
  userSlug?: string
  blogSlug?: string
  // For subdomain blogs
  subdomain?: string
  // For custom domain blogs
  customDomain?: string
  // Post identifier
  postSlug: string
}

export interface PostCreateData {
  blogId: string
  title: string
  content: string
  excerpt?: string
  slug: string
  isPublished?: boolean
  publishedAt?: Date | null
  contentSource?: ContentSource
  contentFormat?: ContentFormat
  evernoteNoteId?: string | null
  ghostPostId?: string | null
  sourceUrl?: string | null
}

export interface PostUpdateData {
  title?: string
  content?: string
  excerpt?: string
  slug?: string
  isPublished?: boolean
  publishedAt?: Date | null
  sourceUrl?: string | null
  sourceUpdatedAt?: Date
}

export class PostRepository {
  /**
   * Find post by ID
   */
  static async findById(postId: string): Promise<PostWithBlog | null> {
    return prisma.post.findUnique({
      where: { id: postId },
      include: {
        blog: {
          include: {
            user: {
              select: {
                id: true,
                slug: true,
                displayName: true
              }
            }
          }
        },
        postTags: {
          include: {
            tag: true
          }
        }
      }
    })
  }

  /**
   * Find post by query (subdomain, custom domain, or path-based)
   */
  static async findByQuery(query: PostQuery): Promise<PostWithBlog | null> {
    const whereClause: Prisma.PostWhereInput = {
      slug: query.postSlug,
      isPublished: true
    }

    if (query.subdomain) {
      whereClause.blog = {
        subdomain: query.subdomain,
        urlFormat: 'subdomain',
        isPublic: true
      }
    } else if (query.customDomain) {
      whereClause.blog = {
        customDomain: query.customDomain,
        urlFormat: 'custom',
        isPublic: true
      }
    } else if (query.userSlug && query.blogSlug) {
      whereClause.blog = {
        slug: query.blogSlug,
        user: { slug: query.userSlug },
        isPublic: true
      }
    } else {
      return null
    }

    const post = await prisma.post.findFirst({
      where: whereClause,
      include: {
        blog: {
          include: {
            user: {
              select: {
                id: true,
                slug: true,
                displayName: true
              }
            }
          }
        },
        postTags: {
          include: {
            tag: true
          }
        }
      }
    })

    return post && post.blog.user ? post : null
  }

  /**
   * Find post for user (includes draft posts)
   */
  static async findByIdForUser(postId: string, userId: string): Promise<PostWithBlog | null> {
    return prisma.post.findFirst({
      where: {
        id: postId,
        blog: { userId }
      },
      include: {
        blog: {
          include: {
            user: {
              select: {
                id: true,
                slug: true,
                displayName: true
              }
            }
          }
        },
        postTags: {
          include: {
            tag: true
          }
        }
      }
    })
  }

  /**
   * Find posts for a blog
   */
  static async findForBlog(
    blogId: string,
    options: {
      published?: boolean
      limit?: number
      offset?: number
      tagSlug?: string
    } = {}
  ): Promise<PostWithTags[]> {
    const { published = true, limit = 50, offset = 0, tagSlug } = options

    return prisma.post.findMany({
      where: {
        blogId,
        ...(published !== undefined && { isPublished: published }),
        ...(tagSlug && tagSlug !== 'all' ? {
          postTags: {
            some: {
              tag: { slug: tagSlug }
            }
          }
        } : {})
      },
      include: {
        postTags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      skip: offset
    })
  }

  /**
   * Find posts by Evernote note ID
   */
  static async findByEvernoteNoteId(noteId: string): Promise<PostWithTags | null> {
    return prisma.post.findFirst({
      where: { evernoteNoteId: noteId },
      include: {
        postTags: {
          include: {
            tag: true
          }
        }
      }
    })
  }

  /**
   * Find posts by Ghost post ID
   */
  static async findByGhostPostId(ghostPostId: string): Promise<PostWithTags | null> {
    return prisma.post.findFirst({
      where: { ghostPostId },
      include: {
        postTags: {
          include: {
            tag: true
          }
        }
      }
    })
  }

  /**
   * Find draft post by ID or Ghost ID for preview
   */
  static async findDraftForPreview(
    postId: string,
    userId: string
  ): Promise<PostWithBlog | null> {
    // Try to find by either regular ID or Ghost post ID
    const post = await prisma.post.findFirst({
      where: {
        OR: [
          { id: postId },
          { ghostPostId: postId }
        ],
        blog: { userId }
      },
      include: {
        blog: {
          include: {
            user: {
              select: {
                id: true,
                slug: true,
                displayName: true
              }
            }
          }
        },
        postTags: {
          include: {
            tag: true
          }
        }
      }
    })

    return post
  }

  /**
   * Create a new post
   */
  static async create(data: PostCreateData): Promise<PostWithTags> {
    return prisma.post.create({
      data: {
        blogId: data.blogId,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt,
        slug: data.slug,
        isPublished: data.isPublished ?? false,
        publishedAt: data.publishedAt,
        contentSource: data.contentSource,
        contentFormat: data.contentFormat,
        evernoteNoteId: data.evernoteNoteId,
        ghostPostId: data.ghostPostId,
        sourceUrl: data.sourceUrl,
        sourceUpdatedAt: new Date()
      },
      include: {
        postTags: {
          include: {
            tag: true
          }
        }
      }
    })
  }

  /**
   * Update a post
   */
  static async update(
    postId: string,
    data: PostUpdateData,
    userId?: string
  ): Promise<PostWithTags | null> {
    try {
      // If userId provided, ensure ownership
      if (userId) {
        const post = await prisma.post.findFirst({
          where: { id: postId, blog: { userId } }
        })
        if (!post) return null
      }

      return await prisma.post.update({
        where: { id: postId },
        data: {
          ...data,
          ...(Object.keys(data).length > 0 && { updatedAt: new Date() })
        },
        include: {
          postTags: {
            include: {
              tag: true
            }
          }
        }
      })
    } catch {
      return null
    }
  }

  /**
   * Delete a post
   */
  static async delete(postId: string, userId?: string): Promise<boolean> {
    try {
      // If userId provided, ensure ownership
      if (userId) {
        const post = await prisma.post.findFirst({
          where: { id: postId, blog: { userId } }
        })
        if (!post) return false
      }

      await prisma.post.delete({
        where: { id: postId }
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if slug is available for blog
   */
  static async isSlugAvailable(
    slug: string,
    blogId: string,
    excludePostId?: string
  ): Promise<boolean> {
    const existingPost = await prisma.post.findFirst({
      where: {
        slug,
        blogId,
        ...(excludePostId && { id: { not: excludePostId } })
      }
    })
    return !existingPost
  }

  /**
   * Publish/unpublish a post
   */
  static async setPublished(
    postId: string,
    isPublished: boolean,
    userId?: string
  ): Promise<PostWithTags | null> {
    const data: PostUpdateData = {
      isPublished,
      publishedAt: isPublished ? new Date() : null
    }

    return this.update(postId, data, userId)
  }

  /**
   * Get posts without tags (for tagging system)
   */
  static async findWithoutTags(): Promise<Array<PostWithTags & { blog: { title: string } }>> {
    return prisma.post.findMany({
      where: {
        postTags: {
          none: {}
        }
      },
      include: {
        blog: {
          select: {
            title: true
          }
        },
        postTags: {
          include: {
            tag: true
          }
        }
      }
    })
  }

  /**
   * Search posts
   */
  static async search(
    query: string,
    blogId?: string,
    options: {
      published?: boolean
      limit?: number
      offset?: number
    } = {}
  ): Promise<PostWithTags[]> {
    const { published = true, limit = 20, offset = 0 } = options

    return prisma.post.findMany({
      where: {
        ...(blogId && { blogId }),
        ...(published !== undefined && { isPublished: published }),
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { excerpt: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        postTags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      skip: offset
    })
  }

  /**
   * Get post statistics for a blog
   */
  static async getStatsForBlog(blogId: string): Promise<{
    total: number
    published: number
    drafts: number
    evernoteCount: number
    ghostCount: number
  }> {
    const [
      total,
      published,
      evernoteCount,
      ghostCount
    ] = await Promise.all([
      prisma.post.count({ where: { blogId } }),
      prisma.post.count({ where: { blogId, isPublished: true } }),
      prisma.post.count({ where: { blogId, contentSource: ContentSource.EVERNOTE } }),
      prisma.post.count({ where: { blogId, contentSource: ContentSource.GHOST } })
    ])

    return {
      total,
      published,
      drafts: total - published,
      evernoteCount,
      ghostCount
    }
  }

  /**
   * Get recent posts for user
   */
  static async getRecentForUser(
    userId: string,
    limit: number = 10
  ): Promise<Array<PostWithTags & { blog: { title: string; slug: string } }>> {
    return prisma.post.findMany({
      where: {
        blog: { userId }
      },
      include: {
        blog: {
          select: {
            title: true,
            slug: true
          }
        },
        postTags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    })
  }
}