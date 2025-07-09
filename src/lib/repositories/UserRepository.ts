import { prisma } from '@/lib/prisma'
import { User, Prisma } from '@prisma/client'

export type UserWithBlogs = User & {
  blogs: Array<{
    id: string
    title: string
    slug: string
    isPublic: boolean
    customDomain: string | null
    subdomain: string | null
    urlFormat: string
    theme: string
    createdAt: Date
    updatedAt: Date
  }>
}

export type UserProfile = Pick<User, 
  'id' | 'name' | 'email' | 'displayName' | 'slug' | 'role' | 'isActive' | 'createdAt' | 'updatedAt'
>

export interface UserCreateData {
  email: string
  name?: string
  displayName?: string
  slug?: string
  provider?: string
  providerId?: string
  evernoteToken?: string
  evernoteNoteStoreUrl?: string
}

export interface UserUpdateData {
  name?: string
  displayName?: string
  slug?: string
  isActive?: boolean
  evernoteToken?: string
  evernoteNoteStoreUrl?: string
  evernoteUserId?: string
  ghostSiteUrl?: string
  ghostApiToken?: string
}

export class UserRepository {
  /**
   * Find user by ID
   */
  static async findById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId }
    })
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email }
    })
  }

  /**
   * Find user by slug
   */
  static async findBySlug(slug: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { slug }
    })
  }

  /**
   * Find user with blogs
   */
  static async findWithBlogs(userId: string): Promise<UserWithBlogs | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        blogs: {
          select: {
            id: true,
            title: true,
            slug: true,
            isPublic: true,
            customDomain: true,
            subdomain: true,
            urlFormat: true,
            theme: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { updatedAt: 'desc' }
        }
      }
    })
  }

  /**
   * Get user profile (safe for public consumption)
   */
  static async getProfile(userId: string): Promise<UserProfile | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        displayName: true,
        slug: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    })
  }

  /**
   * Create a new user
   */
  static async create(data: UserCreateData): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        displayName: data.displayName,
        slug: data.slug,
        provider: data.provider,
        providerId: data.providerId,
        evernoteToken: data.evernoteToken,
        evernoteNoteStoreUrl: data.evernoteNoteStoreUrl,
        isActive: true,
        role: 'USER'
      }
    })
  }

  /**
   * Update user
   */
  static async update(userId: string, data: UserUpdateData): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data
      })
    } catch {
      return null
    }
  }

  /**
   * Update user role (admin only)
   */
  static async updateRole(userId: string, role: 'USER' | 'ADMIN'): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { role }
      })
    } catch {
      return null
    }
  }

  /**
   * Deactivate user
   */
  static async deactivate(userId: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete user and all associated data
   */
  static async delete(userId: string): Promise<boolean> {
    try {
      // This will cascade delete blogs, posts, etc. due to foreign key constraints
      await prisma.user.delete({
        where: { id: userId }
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if email is available
   */
  static async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        ...(excludeUserId && { id: { not: excludeUserId } })
      }
    })
    return !existingUser
  }

  /**
   * Check if slug is available
   */
  static async isSlugAvailable(slug: string, excludeUserId?: string): Promise<boolean> {
    const existingUser = await prisma.user.findFirst({
      where: {
        slug,
        ...(excludeUserId && { id: { not: excludeUserId } })
      }
    })
    return !existingUser
  }

  /**
   * Find users by role
   */
  static async findByRole(role: 'USER' | 'ADMIN'): Promise<UserProfile[]> {
    return prisma.user.findMany({
      where: { role },
      select: {
        id: true,
        name: true,
        email: true,
        displayName: true,
        slug: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Get all users (admin only)
   */
  static async findAll(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ users: UserProfile[]; total: number }> {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          slug: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.user.count()
    ])

    return { users, total }
  }

  /**
   * Find users with Evernote integration
   */
  static async findWithEvernoteToken(): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        evernoteToken: { not: null },
        isActive: true
      }
    })
  }

  /**
   * Find users with Ghost integration
   */
  static async findWithGhostIntegration(): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        ghostApiToken: { not: null },
        ghostSiteUrl: { not: null },
        isActive: true
      }
    })
  }

  /**
   * Update Evernote integration
   */
  static async updateEvernoteIntegration(
    userId: string,
    data: {
      evernoteToken?: string | null
      evernoteNoteStoreUrl?: string | null
      evernoteUserId?: string | null
    }
  ): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data
      })
    } catch {
      return null
    }
  }

  /**
   * Update Ghost integration
   */
  static async updateGhostIntegration(
    userId: string,
    data: {
      ghostSiteUrl?: string | null
      ghostApiToken?: string | null
    }
  ): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data
      })
    } catch {
      return null
    }
  }

  /**
   * Get user statistics
   */
  static async getStats(userId: string): Promise<{
    blogsCount: number
    postsCount: number
    publishedPostsCount: number
  }> {
    const [blogsCount, postsCount, publishedPostsCount] = await Promise.all([
      prisma.blog.count({ where: { userId } }),
      prisma.post.count({ 
        where: { 
          blog: { userId } 
        } 
      }),
      prisma.post.count({ 
        where: { 
          blog: { userId },
          isPublished: true
        } 
      })
    ])

    return {
      blogsCount,
      postsCount,
      publishedPostsCount
    }
  }
}