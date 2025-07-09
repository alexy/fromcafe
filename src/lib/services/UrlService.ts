/**
 * Centralized URL generation service for multi-tenant application
 * Consolidates URL handling patterns from across the codebase
 */

import { isCustomDomain } from '@/config/domains'

export class UrlService {
  /**
   * Check if hostname is a subdomain of the primary domain
   */
  static isSubdomain(hostname?: string): boolean {
    if (!hostname) return false
    
    return hostname.includes('.from.cafe') && 
           !hostname.startsWith('www.') && 
           hostname !== 'from.cafe'
  }

  /**
   * Check if hostname is a custom domain OR subdomain
   */
  static isCustomDomainOrSubdomain(hostname?: string): boolean {
    if (!hostname) return false
    
    return isCustomDomain(hostname) || this.isSubdomain(hostname)
  }

  /**
   * Generate post URL based on domain context
   */
  static getPostUrl(
    userSlug: string | undefined, 
    blogSlug: string, 
    postSlug: string, 
    hostname?: string
  ): string {
    if (!userSlug) return `/${blogSlug}/${postSlug}`
    
    // Custom domain/subdomain: clean URLs (just /postSlug)
    if (hostname && this.isCustomDomainOrSubdomain(hostname)) {
      return `/${postSlug}`
    }
    
    // Main domain: full path (/userSlug/blogSlug/postSlug)
    return `/${userSlug}/${blogSlug}/${postSlug}`
  }

  /**
   * Generate blog URL based on domain context
   */
  static getBlogUrl(
    userSlug: string | undefined, 
    blogSlug: string, 
    hostname?: string
  ): string {
    if (!userSlug) return `/${blogSlug}`
    
    // Custom domain/subdomain: clean URLs (just /)
    if (hostname && this.isCustomDomainOrSubdomain(hostname)) {
      return `/`
    }
    
    // Main domain: full path (/userSlug/blogSlug)
    return `/${userSlug}/${blogSlug}`
  }

  /**
   * Generate preview URL for drafts
   */
  static getPreviewUrl(postId: string, hostname?: string): string {
    if (hostname && this.isCustomDomainOrSubdomain(hostname)) {
      return `/p/preview/${postId}`
    }
    
    return `/p/preview/${postId}`
  }

  /**
   * Generate tag filter URL
   */
  static getTagUrl(
    userSlug: string | undefined,
    blogSlug: string,
    tagSlug: string,
    hostname?: string
  ): string {
    const baseUrl = this.getBlogUrl(userSlug, blogSlug, hostname)
    return `${baseUrl}?tag=${tagSlug}`
  }

  /**
   * Generate dashboard URL for blog management
   */
  static getDashboardUrl(blogId: string): string {
    return `/dashboard/blogs/${blogId}`
  }

  /**
   * Generate authentication URLs based on context
   */
  static getAuthUrl(action: 'signin' | 'signup', hostname?: string): string {
    if (hostname && this.isCustomDomainOrSubdomain(hostname)) {
      return `/auth/${action}`
    }
    
    return `/auth/${action}`
  }

  /**
   * Generate subdomain URL for a blog
   */
  static getSubdomainUrl(blogSlug: string): string {
    return `https://${blogSlug}.from.cafe`
  }

  /**
   * Extract subdomain from hostname
   */
  static extractSubdomain(hostname: string): string | null {
    if (!this.isSubdomain(hostname)) return null
    
    return hostname.split('.')[0]
  }

  /**
   * Generate canonical URL for SEO
   */
  static getCanonicalUrl(
    userSlug: string | undefined,
    blogSlug: string,
    postSlug?: string,
    customDomain?: string
  ): string {
    const baseUrl = customDomain 
      ? `https://${customDomain}`
      : this.getSubdomainUrl(blogSlug)
    
    if (postSlug) {
      return `${baseUrl}/${postSlug}`
    }
    
    return baseUrl
  }
}