/**
 * Utility functions for generating correct URLs based on domain context
 */

export function isSubdomain(hostname?: string): boolean {
  if (!hostname) return false
  
  // Check if we're on a subdomain (anything other than the main domain)
  return hostname.includes('.from.cafe') && !hostname.startsWith('www.') && hostname !== 'from.cafe'
}

export function getPostUrl(userSlug: string | undefined, blogSlug: string, postSlug: string, hostname?: string): string {
  if (!userSlug) return `/${blogSlug}/${postSlug}`
  
  // If we're on a subdomain, use clean relative URLs (just /blogSlug/postSlug)
  if (hostname && isSubdomain(hostname)) {
    return `/${blogSlug}/${postSlug}`
  }
  
  // If we're on main domain, use full path (/userSlug/blogSlug/postSlug)  
  return `/${userSlug}/${blogSlug}/${postSlug}`
}

export function getBlogUrl(userSlug: string | undefined, blogSlug: string, hostname?: string): string {
  if (!userSlug) return `/${blogSlug}`
  
  // If we're on a subdomain, use clean relative URLs (just /blogSlug)
  if (hostname && isSubdomain(hostname)) {
    return `/${blogSlug}`
  }
  
  // If we're on main domain, use full path (/userSlug/blogSlug)
  return `/${userSlug}/${blogSlug}`
}