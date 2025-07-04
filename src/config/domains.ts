/**
 * Domain configuration for multi-tenant application
 */

export const DOMAIN_CONFIG = {
  // Primary domain that serves the main application
  PRIMARY_DOMAIN: process.env.PRIMARY_DOMAIN || 'from.cafe',
  
  // Fallback domains for development/staging
  DEVELOPMENT_DOMAINS: ['localhost', 'vercel.app'],
  
  // Redirect status code for custom domains
  REDIRECT_STATUS_CODE: 307,
} as const

/**
 * Check if a hostname is a custom domain (not the primary domain or development domains)
 */
export function isCustomDomain(hostname: string): boolean {
  const cleanHostname = hostname.split(':')[0].toLowerCase()
  
  // Check if it's the primary domain
  if (cleanHostname.includes(DOMAIN_CONFIG.PRIMARY_DOMAIN)) {
    return false
  }
  
  // Check if it's a development domain
  if (DOMAIN_CONFIG.DEVELOPMENT_DOMAINS.some(dev => cleanHostname.includes(dev))) {
    return false
  }
  
  return true
}

/**
 * Get the primary domain for redirects and API calls
 */
export function getPrimaryDomain(): string {
  return DOMAIN_CONFIG.PRIMARY_DOMAIN
}

/**
 * Get the redirect status code for custom domains
 */
export function getRedirectStatusCode(): number {
  return DOMAIN_CONFIG.REDIRECT_STATUS_CODE
}