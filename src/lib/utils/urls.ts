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
  
  console.log('🔗 getPostUrl called:', { userSlug, blogSlug, postSlug, hostname, isSubdomainResult: hostname ? isSubdomain(hostname) : 'no hostname' })
  
  // If we're on a subdomain, use clean relative URLs (just /blogSlug/postSlug)
  if (hostname && isSubdomain(hostname)) {
    const url = `/${blogSlug}/${postSlug}`
    console.log('🔗 Subdomain detected, using relative URL:', url)
    return url
  }
  
  // If we're on main domain, use full path (/userSlug/blogSlug/postSlug)  
  const url = `/${userSlug}/${blogSlug}/${postSlug}`
  console.log('🔗 Main domain, using full path:', url)
  return url
}

export function getBlogUrl(userSlug: string | undefined, blogSlug: string, hostname?: string): string {
  if (!userSlug) return `/${blogSlug}`
  
  console.log('🔗 getBlogUrl called:', { userSlug, blogSlug, hostname, isSubdomainResult: hostname ? isSubdomain(hostname) : 'no hostname' })
  
  // If we're on a subdomain, use clean relative URLs (just /blogSlug)
  if (hostname && isSubdomain(hostname)) {
    const url = `/${blogSlug}`
    console.log('🔗 Subdomain detected, using relative URL:', url)
    return url
  }
  
  // If we're on main domain, use full path (/userSlug/blogSlug)
  const url = `/${userSlug}/${blogSlug}`
  console.log('🔗 Main domain, using full path:', url)
  return url
}