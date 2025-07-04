// Site configuration with customizable settings
export const siteConfig = {
  // Basic site information
  name: "FromCafe",
  description: "Transform your Evernote notes into beautiful blogs",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  
  // Reserved slugs that cannot be used for user slugs
  reservedUserSlugs: [
    // System routes - required for app functionality
    'dashboard',
    'auth',
    'api',
    'onboarding',
    'admin',
    
    // Technical subdomains/routes
    'www',
    'mail',
    'ftp',
    'smtp',
    'pop',
    'imap',
    'blog',
    'app',
    'cdn',
    'static',
    'assets',
    'media',
    'uploads',
    'files',
    'images',
    
    // Support/marketing pages
    'help',
    'support',
    'about',
    'contact',
    'privacy',
    'terms',
    'legal',
    'pricing',
    'docs',
    'documentation',
    'faq',
    'guides',
    'tutorials',
    
    // Common user-related terms to avoid confusion
    'user',
    'users',
    'account',
    'accounts',
    'profile',
    'profiles',
    'settings',
    'config',
    'configuration',
    'preferences',
    
    // Blog-related terms
    'blog',
    'blogs',
    'post',
    'posts',
    'article',
    'articles',
    'news',
    'updates',
    
    // Common reserved words
    'root',
    'system',
    'public',
    'private',
    'secure',
    'test',
    'demo',
    'example',
    'sample',
    'temp',
    'temporary',
    'backup',
    'archive',
    
    // Social/marketing terms
    'social',
    'facebook',
    'twitter',
    'instagram',
    'linkedin',
    'youtube',
    'tiktok',
    'discord',
    'slack',
    
    // Business terms
    'business',
    'enterprise',
    'pro',
    'premium',
    'plus',
    'team',
    'teams',
    'organization',
    'org',
    'company',
    'site',
  ],
  
  // Reserved slugs that cannot be used for blog slugs (within user spaces)
  reservedBlogSlugs: [
    // User-level reserved routes
    'dashboard',
    'settings',
    'admin',
    'api',
    
    // Common blog-level conflicts
    'posts',
    'post',
    'blog',
    'feed',
    'rss',
    'atom',
    'sitemap',
    'robots',
    'manifest',
    'search',
    'archive',
    'archives',
    'category',
    'categories',
    'tag',
    'tags',
    'author',
    'authors',
    'about',
    'contact',
    'subscribe',
    'unsubscribe',
  ],
  
  // Slug validation rules
  slugRules: {
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-z0-9-]+$/, // Only lowercase letters, numbers, and hyphens
    cannotStartWith: ['-'],
    cannotEndWith: ['-'],
    cannotContain: ['--'], // No consecutive hyphens
  },
  
  // User settings
  user: {
    maxBlogs: 10, // Maximum blogs per user (0 = unlimited)
    maxPostsPerBlog: 1000, // Maximum posts per blog (0 = unlimited)
    allowCustomDomains: true,
    allowSubdomains: true,
  },
  
  // Admin settings
  admin: {
    defaultRole: 'USER',
    allowUserRoleChange: true,
    maxUsersPerAdmin: 0, // 0 = unlimited
    password: 'Freewrite', // Password to access admin console
  },
  
  // Feature flags
  features: {
    userRegistration: true,
    blogCreation: true,
    customThemes: true,
    analytics: false,
    comments: false,
    newsletters: false,
  },
  
  // Integration settings
  integrations: {
    evernote: {
      enabled: true,
      requireConnection: false, // If true, users must connect Evernote
    },
    google: {
      enabled: true,
    },
  },
}

// Helper function to check if a slug is reserved for users
export function isReservedUserSlug(slug: string): boolean {
  return siteConfig.reservedUserSlugs.includes(slug.toLowerCase())
}

// Helper function to check if a slug is reserved for blogs
export function isReservedBlogSlug(slug: string): boolean {
  return siteConfig.reservedBlogSlugs.includes(slug.toLowerCase())
}

// Helper function to validate user slug
export function validateUserSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) {
    return { valid: false, error: 'Slug is required' }
  }
  
  if (slug.length < siteConfig.slugRules.minLength) {
    return { valid: false, error: `Slug must be at least ${siteConfig.slugRules.minLength} characters long` }
  }
  
  if (slug.length > siteConfig.slugRules.maxLength) {
    return { valid: false, error: `Slug cannot be longer than ${siteConfig.slugRules.maxLength} characters` }
  }
  
  if (!siteConfig.slugRules.pattern.test(slug)) {
    return { valid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' }
  }
  
  // Check start/end restrictions
  for (const char of siteConfig.slugRules.cannotStartWith) {
    if (slug.startsWith(char)) {
      return { valid: false, error: `Slug cannot start with "${char}"` }
    }
  }
  
  for (const char of siteConfig.slugRules.cannotEndWith) {
    if (slug.endsWith(char)) {
      return { valid: false, error: `Slug cannot end with "${char}"` }
    }
  }
  
  // Check forbidden patterns
  for (const pattern of siteConfig.slugRules.cannotContain) {
    if (slug.includes(pattern)) {
      return { valid: false, error: `Slug cannot contain "${pattern}"` }
    }
  }
  
  if (isReservedUserSlug(slug)) {
    return { valid: false, error: 'This slug is reserved and cannot be used' }
  }
  
  return { valid: true }
}

// Helper function to validate blog slug
export function validateBlogSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) {
    return { valid: false, error: 'Blog slug is required' }
  }
  
  if (slug.length < siteConfig.slugRules.minLength) {
    return { valid: false, error: `Blog slug must be at least ${siteConfig.slugRules.minLength} characters long` }
  }
  
  if (slug.length > siteConfig.slugRules.maxLength) {
    return { valid: false, error: `Blog slug cannot be longer than ${siteConfig.slugRules.maxLength} characters` }
  }
  
  if (!siteConfig.slugRules.pattern.test(slug)) {
    return { valid: false, error: 'Blog slug can only contain lowercase letters, numbers, and hyphens' }
  }
  
  // Check start/end restrictions
  for (const char of siteConfig.slugRules.cannotStartWith) {
    if (slug.startsWith(char)) {
      return { valid: false, error: `Blog slug cannot start with "${char}"` }
    }
  }
  
  for (const char of siteConfig.slugRules.cannotEndWith) {
    if (slug.endsWith(char)) {
      return { valid: false, error: `Blog slug cannot end with "${char}"` }
    }
  }
  
  // Check forbidden patterns
  for (const pattern of siteConfig.slugRules.cannotContain) {
    if (slug.includes(pattern)) {
      return { valid: false, error: `Blog slug cannot contain "${pattern}"` }
    }
  }
  
  if (isReservedBlogSlug(slug)) {
    return { valid: false, error: 'This blog slug is reserved and cannot be used' }
  }
  
  return { valid: true }
}

// Helper function to generate a safe slug from input text
export function generateSafeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9-]/g, '-')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '')
    // Limit length
    .slice(0, siteConfig.slugRules.maxLength)
}