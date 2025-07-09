/**
 * Legacy URL utility functions - maintained for backward compatibility
 * New code should use UrlService and DomainService from @/lib/services
 */

import { UrlService } from '@/lib/services'

// Re-export service methods for backward compatibility
export const isSubdomain = UrlService.isSubdomain
export const isCustomDomainOrSubdomain = UrlService.isCustomDomainOrSubdomain
export const getPostUrl = UrlService.getPostUrl
export const getBlogUrl = UrlService.getBlogUrl