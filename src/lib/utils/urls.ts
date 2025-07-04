/**
 * Utility functions for generating correct URLs based on domain context
 */

import { isCustomDomain } from '@/config/domains'

export function isSubdomain(hostname?: string): boolean {
  if (!hostname) return false
  
  // Check if we're on a subdomain (anything other than the main domain)
  return hostname.includes('.from.cafe') && !hostname.startsWith('www.') && hostname !== 'from.cafe'
}

export function isCustomDomainOrSubdomain(hostname?: string): boolean {
  if (!hostname) return false
  
  // Check if it's a custom domain OR a subdomain
  return isCustomDomain(hostname) || isSubdomain(hostname)
}

export function getPostUrl(userSlug: string | undefined, blogSlug: string, postSlug: string, hostname?: string): string {
  if (!userSlug) return `/${blogSlug}/${postSlug}`
  
  // If we're on a custom domain or subdomain, use clean relative URLs (just /postSlug)
  if (hostname && isCustomDomainOrSubdomain(hostname)) {
    return `/${postSlug}`
  }
  
  // If we're on main domain, use full path (/userSlug/blogSlug/postSlug)  
  return `/${userSlug}/${blogSlug}/${postSlug}`
}

export function getBlogUrl(userSlug: string | undefined, blogSlug: string, hostname?: string): string {
  if (!userSlug) return `/${blogSlug}`
  
  // If we're on a custom domain or subdomain, use clean relative URLs (just /)
  if (hostname && isCustomDomainOrSubdomain(hostname)) {
    return `/`
  }
  
  // If we're on main domain, use full path (/userSlug/blogSlug)
  return `/${userSlug}/${blogSlug}`
}