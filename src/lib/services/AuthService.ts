/**
 * Centralized authentication service
 * Consolidates auth-related operations and session management
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { User, UserRole } from '@prisma/client'

export interface AuthUser extends User {
  isAuthenticated: true
}

export interface AuthResult {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  isActive: boolean
}

export interface SessionUser {
  id: string
  email: string
  name?: string
  role: UserRole
  isActive: boolean
}

export class AuthService {
  /**
   * Get current authenticated user with full database data
   */
  static async getCurrentUser(): Promise<AuthUser | null> {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        blogs: {
          select: {
            id: true,
            title: true,
            slug: true,
            isPublic: true
          }
        }
      }
    })

    if (!user || !user.isActive) {
      return null
    }

    return { ...user, isAuthenticated: true } as AuthUser
  }

  /**
   * Get authentication result with role and status checks
   */
  static async getAuthResult(): Promise<AuthResult> {
    const user = await this.getCurrentUser()
    
    return {
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'ADMIN',
      isActive: user?.isActive ?? false
    }
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    const { isAuthenticated } = await this.getAuthResult()
    return isAuthenticated
  }

  /**
   * Check if user is admin
   */
  static async isAdmin(): Promise<boolean> {
    const { isAdmin } = await this.getAuthResult()
    return isAdmin
  }

  /**
   * Check if user owns a specific blog
   */
  static async userOwnsBlog(userId: string, blogId: string): Promise<boolean> {
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        userId
      }
    })
    
    return !!blog
  }

  /**
   * Get user by ID with role validation
   */
  static async getUserById(userId: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        blogs: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        }
      }
    })
  }

  /**
   * Require authentication - throws if not authenticated
   */
  static async requireAuth(): Promise<AuthUser> {
    const user = await this.getCurrentUser()
    
    if (!user) {
      throw new Error('Authentication required')
    }
    
    return user
  }

  /**
   * Require admin role - throws if not admin
   */
  static async requireAdmin(): Promise<AuthUser> {
    const user = await this.requireAuth()
    
    if (user.role !== 'ADMIN') {
      throw new Error('Admin access required')
    }
    
    return user
  }

  /**
   * Require blog ownership - throws if user doesn't own blog
   */
  static async requireBlogOwnership(blogId: string): Promise<AuthUser> {
    const user = await this.requireAuth()
    
    const ownsBlog = await this.userOwnsBlog(user.id, blogId)
    
    if (!ownsBlog) {
      throw new Error('Blog ownership required')
    }
    
    return user
  }

  /**
   * Update user role
   */
  static async updateUserRole(userId: string, role: UserRole): Promise<User> {
    return await prisma.user.update({
      where: { id: userId },
      data: { role }
    })
  }

  /**
   * Activate/deactivate user
   */
  static async setUserActive(userId: string, isActive: boolean): Promise<User> {
    return await prisma.user.update({
      where: { id: userId },
      data: { isActive }
    })
  }

  /**
   * Get user's blog count
   */
  static async getUserBlogCount(userId: string): Promise<number> {
    return await prisma.blog.count({
      where: { userId }
    })
  }

  /**
   * Check if user can create more blogs
   */
  static async canCreateBlog(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId)
    
    if (!user) return false
    
    // Admins can create unlimited blogs
    if (user.role === 'ADMIN') return true
    
    // Regular users limited to a certain number
    const blogCount = await this.getUserBlogCount(userId)
    const maxBlogs = parseInt(process.env.MAX_BLOGS_PER_USER || '5')
    
    return blogCount < maxBlogs
  }
}