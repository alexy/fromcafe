/**
 * Centralized session management service
 * Handles session tokens, validation, and refresh operations
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DomainService } from './DomainService'
import type { Session } from 'next-auth'

interface ExtendedUser {
  id: string
  role: string
  isActive: boolean
  name?: string | null
  email?: string | null
  image?: string | null
}

interface ExtendedSession extends Session {
  user: ExtendedUser
}

export interface SessionInfo {
  session: Session | null
  isValid: boolean
  userId?: string
  userRole?: string
  isActive?: boolean
}

export interface SessionOptions {
  requireAuth?: boolean
  requireAdmin?: boolean
  requireActive?: boolean
}

export class SessionService {
  /**
   * Get current session with validation
   */
  static async getSession(): Promise<Session | null> {
    return await getServerSession(authOptions)
  }

  /**
   * Get session information with validation checks
   */
  static async getSessionInfo(options: SessionOptions = {}): Promise<SessionInfo> {
    const session = await this.getSession()
    
    const isValid = this.validateSession(session, options)
    
    return {
      session,
      isValid,
      userId: (session as ExtendedSession)?.user?.id,
      userRole: (session as ExtendedSession)?.user?.role,
      isActive: (session as ExtendedSession)?.user?.isActive
    }
  }

  /**
   * Validate session against requirements
   */
  static validateSession(session: Session | null, options: SessionOptions = {}): boolean {
    // No session found
    if (!session?.user) {
      return !options.requireAuth
    }

    // Check if authentication is required
    if (options.requireAuth && !(session as ExtendedSession).user.id) {
      return false
    }

    // Check if admin role is required
    if (options.requireAdmin && (session as ExtendedSession).user.role !== 'ADMIN') {
      return false
    }

    // Check if active status is required
    if (options.requireActive && (session as ExtendedSession).user.isActive === false) {
      return false
    }

    return true
  }

  /**
   * Require valid session - throws if invalid
   */
  static async requireValidSession(options: SessionOptions = {}): Promise<Session> {
    const { session, isValid } = await this.getSessionInfo(options)
    
    if (!isValid || !session) {
      if (options.requireAdmin) {
        throw new Error('Admin authentication required')
      }
      if (options.requireActive) {
        throw new Error('Active user account required')
      }
      throw new Error('Valid authentication required')
    }
    
    return session
  }

  /**
   * Get user ID from session
   */
  static async getUserId(): Promise<string | null> {
    const session = await this.getSession()
    return (session as ExtendedSession)?.user?.id || null
  }

  /**
   * Check if current user is admin
   */
  static async isAdmin(): Promise<boolean> {
    const session = await this.getSession()
    return (session as ExtendedSession)?.user?.role === 'ADMIN'
  }

  /**
   * Check if current user is active
   */
  static async isActive(): Promise<boolean> {
    const session = await this.getSession()
    return (session as ExtendedSession)?.user?.isActive !== false
  }

  /**
   * Get appropriate sign-in URL based on domain context
   */
  static getSignInUrl(hostname?: string, callbackUrl?: string): string {
    const baseUrl = DomainService.isCustomContext(hostname) 
      ? '' // Relative URL for custom domains
      : DomainService.getApiBaseUrl(hostname)
    
    let signInUrl = `${baseUrl}/auth/signin`
    
    if (callbackUrl) {
      signInUrl += `?callbackUrl=${encodeURIComponent(callbackUrl)}`
    }
    
    return signInUrl
  }

  /**
   * Get appropriate sign-out URL based on domain context
   */
  static getSignOutUrl(hostname?: string, callbackUrl?: string): string {
    const baseUrl = DomainService.isCustomContext(hostname)
      ? '' // Relative URL for custom domains  
      : DomainService.getApiBaseUrl(hostname)
    
    let signOutUrl = `${baseUrl}/api/auth/signout`
    
    if (callbackUrl) {
      signOutUrl += `?callbackUrl=${encodeURIComponent(callbackUrl)}`
    }
    
    return signOutUrl
  }

  /**
   * Get dashboard URL for post-auth redirect
   */
  static getDashboardUrl(hostname?: string): string {
    if (DomainService.isCustomContext(hostname)) {
      // Redirect to main domain for dashboard
      return `${DomainService.getApiBaseUrl()}/dashboard`
    }
    
    return '/dashboard'
  }

  /**
   * Check if session token needs refresh
   */
  static shouldRefreshToken(session: Session | null): boolean {
    if (!session) return false
    
    // Check if token is close to expiration (within 1 hour)
    const tokenExpiry = new Date(session.expires)
    const now = new Date()
    const oneHour = 60 * 60 * 1000
    
    return (tokenExpiry.getTime() - now.getTime()) < oneHour
  }

  /**
   * Get CSRF token for forms
   */
  static async getCsrfToken(): Promise<string | undefined> {
    try {
      const session = await this.getSession()
      return (session as ExtendedSession)?.user?.id // Simple CSRF based on user ID
    } catch {
      return undefined
    }
  }

  /**
   * Validate CSRF token
   */
  static async validateCsrfToken(token: string): Promise<boolean> {
    const expectedToken = await this.getCsrfToken()
    return token === expectedToken
  }
}