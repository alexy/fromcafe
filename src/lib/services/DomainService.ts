/**
 * Centralized domain management service
 * Consolidates domain validation, configuration, and utilities
 */

import { DOMAIN_CONFIG, isCustomDomain, getPrimaryDomain } from '@/config/domains'

export interface DomainInfo {
  hostname: string
  isCustomDomain: boolean
  isSubdomain: boolean
  isPrimaryDomain: boolean
  isDevelopment: boolean
  subdomain?: string
}

export class DomainService {
  /**
   * Analyze domain information for a given hostname
   */
  static analyzeDomain(hostname: string): DomainInfo {
    const cleanHostname = hostname.split(':')[0].toLowerCase()
    
    const isCustom = isCustomDomain(hostname)
    const isSubdomainResult = this.isSubdomain(hostname)
    const isPrimary = this.isPrimaryDomain(hostname)
    const isDev = this.isDevelopment(hostname)
    
    return {
      hostname: cleanHostname,
      isCustomDomain: isCustom,
      isSubdomain: isSubdomainResult,
      isPrimaryDomain: isPrimary,
      isDevelopment: isDev,
      subdomain: isSubdomainResult ? this.extractSubdomain(hostname) : undefined
    }
  }

  /**
   * Check if hostname is the primary domain
   */
  static isPrimaryDomain(hostname: string): boolean {
    const cleanHostname = hostname.split(':')[0].toLowerCase()
    return cleanHostname === DOMAIN_CONFIG.PRIMARY_DOMAIN ||
           cleanHostname === `www.${DOMAIN_CONFIG.PRIMARY_DOMAIN}`
  }

  /**
   * Check if hostname is a development domain
   */
  static isDevelopment(hostname: string): boolean {
    const cleanHostname = hostname.split(':')[0].toLowerCase()
    return DOMAIN_CONFIG.DEVELOPMENT_DOMAINS.some(dev => 
      cleanHostname.includes(dev)
    )
  }

  /**
   * Check if hostname is a subdomain
   */
  static isSubdomain(hostname: string): boolean {
    if (!hostname) return false
    
    const cleanHostname = hostname.split(':')[0].toLowerCase()
    return cleanHostname.includes(`.${DOMAIN_CONFIG.PRIMARY_DOMAIN}`) && 
           !cleanHostname.startsWith('www.') && 
           cleanHostname !== DOMAIN_CONFIG.PRIMARY_DOMAIN
  }

  /**
   * Extract subdomain from hostname
   */
  static extractSubdomain(hostname: string): string | null {
    if (!this.isSubdomain(hostname)) return null
    
    const cleanHostname = hostname.split(':')[0].toLowerCase()
    return cleanHostname.split('.')[0]
  }

  /**
   * Validate domain format
   */
  static isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/
    return domainRegex.test(domain)
  }

  /**
   * Check if domain is available for use (not primary or development domain)
   */
  static isDomainAvailable(domain: string): boolean {
    if (!this.isValidDomain(domain)) return false
    
    const cleanDomain = domain.toLowerCase()
    
    // Cannot use primary domain
    if (cleanDomain === DOMAIN_CONFIG.PRIMARY_DOMAIN) return false
    
    // Cannot use development domains
    if (DOMAIN_CONFIG.DEVELOPMENT_DOMAINS.some(dev => cleanDomain.includes(dev))) {
      return false
    }
    
    return true
  }

  /**
   * Get primary domain
   */
  static getPrimaryDomain(): string {
    return getPrimaryDomain()
  }

  /**
   * Get redirect status code for custom domains
   */
  static getRedirectStatusCode(): number {
    return DOMAIN_CONFIG.REDIRECT_STATUS_CODE
  }

  /**
   * Generate domain verification TXT record
   */
  static generateVerificationRecord(domain: string): string {
    return `fromcafe-verification=${Buffer.from(domain).toString('base64')}`
  }

  /**
   * Check if current request is on custom domain or subdomain
   */
  static isCustomContext(hostname?: string): boolean {
    if (!hostname) return false
    
    return isCustomDomain(hostname) || this.isSubdomain(hostname)
  }

  /**
   * Get appropriate base URL for API calls
   */
  static getApiBaseUrl(hostname?: string): string {
    if (hostname && this.isDevelopment(hostname)) {
      return `http://${hostname}`
    }
    
    return `https://${this.getPrimaryDomain()}`
  }

  /**
   * Normalize hostname for consistent processing
   */
  static normalizeHostname(hostname: string): string {
    return hostname.split(':')[0].toLowerCase().trim()
  }
}