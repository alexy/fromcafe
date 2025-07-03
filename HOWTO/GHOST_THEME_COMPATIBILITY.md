# Ghost Theme Compatibility Design Document

## Executive Summary

This document outlines the architectural design for implementing Ghost-compatible theme support in FromCafe, enabling the platform to use the extensive ecosystem of existing Ghost themes. This would dramatically expand customization options while leveraging the mature Ghost theme development community.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Ghost Theme Architecture Overview](#ghost-theme-architecture-overview)
3. [Technical Requirements](#technical-requirements)
4. [Implementation Strategy](#implementation-strategy)
5. [Data Model Mapping](#data-model-mapping)
6. [Template Engine Integration](#template-engine-integration)
7. [Asset Management](#asset-management)
8. [Theme Installation System](#theme-installation-system)
9. [Security Considerations](#security-considerations)
10. [Performance Implications](#performance-implications)
11. [Migration Strategy](#migration-strategy)
12. [Business Considerations](#business-considerations)

## Problem Statement

### Current State
- FromCafe uses React/Next.js for blog rendering
- Limited theme customization options
- Custom theme development requires React knowledge
- Small ecosystem of available themes

### Target State
- Support for Ghost-compatible themes
- Access to hundreds of existing Ghost themes
- Theme marketplace integration
- Easy theme switching and customization
- Maintain performance and SEO benefits

### Benefits
- **Instant theme library**: Access to 500+ existing Ghost themes
- **Lower development cost**: No need to build custom theme system
- **Professional designs**: High-quality, tested themes
- **Community ecosystem**: Active theme development community
- **User familiarity**: Many users already know Ghost theming

## Ghost Theme Architecture Overview

### Ghost Theme Structure
```
theme-name/
├── package.json          # Theme metadata and dependencies
├── index.hbs             # Homepage template
├── post.hbs              # Individual post template
├── page.hbs              # Static page template
├── tag.hbs               # Tag archive template
├── author.hbs            # Author archive template
├── error.hbs             # Error page template
├── partials/             # Reusable template components
│   ├── header.hbs
│   ├── footer.hbs
│   ├── navigation.hbs
│   └── post-card.hbs
├── assets/               # Static assets
│   ├── css/
│   ├── js/
│   ├── images/
│   └── fonts/
└── locales/              # Internationalization
    ├── en.json
    └── es.json
```

### Ghost Template Engine
- **Handlebars.js**: Template engine used by Ghost
- **Helpers**: Built-in template helpers for common operations
- **Context**: Data passed to templates (posts, pages, settings, etc.)
- **Routing**: Theme-defined routing rules

### Ghost Theme API
- **Theme API**: Access to blog data (posts, pages, tags, authors)
- **Settings API**: Theme configuration and customization
- **Helper functions**: URL generation, date formatting, etc.
- **Asset optimization**: Automatic minification and optimization

## Technical Requirements

### 1. Template Engine Integration

**Handlebars.js Server-Side Rendering**
- Integrate Handlebars.js into Next.js application
- Server-side rendering for SEO and performance
- Template compilation and caching
- Context data injection

**Required Components:**
```typescript
// Template engine wrapper
class GhostTemplateEngine {
  private handlebars: typeof Handlebars
  private templates: Map<string, HandlebarsTemplateDelegate>
  private helpers: Map<string, Function>
  
  async renderTemplate(templateName: string, context: GhostContext): Promise<string>
  async compileTemplate(templateSource: string): Promise<HandlebarsTemplateDelegate>
  registerHelper(name: string, helper: Function): void
  registerPartial(name: string, template: string): void
}

// Context builder
class GhostContextBuilder {
  async buildPostContext(post: Post, blog: Blog): Promise<GhostContext>
  async buildIndexContext(posts: Post[], blog: Blog): Promise<GhostContext>
  async buildTagContext(tag: string, posts: Post[], blog: Blog): Promise<GhostContext>
}
```

### 2. Data Model Mapping

**FromCafe to Ghost Data Structure Mapping**
```typescript
// Ghost-compatible data structures
interface GhostPost {
  id: string
  title: string
  slug: string
  html: string
  plaintext: string
  feature_image: string | null
  featured: boolean
  created_at: string
  updated_at: string
  published_at: string
  excerpt: string
  reading_time: number
  url: string
  tags: GhostTag[]
  authors: GhostAuthor[]
  primary_author: GhostAuthor
  primary_tag: GhostTag | null
}

interface GhostBlog {
  title: string
  description: string
  logo: string | null
  cover_image: string | null
  url: string
  timezone: string
  navigation: GhostNavigation[]
}

interface GhostTag {
  id: string
  name: string
  slug: string
  description: string | null
  url: string
  count: { posts: number }
}
```

### 3. Ghost Helper Functions

**Implementation of Core Ghost Helpers**
```typescript
// Essential Ghost helpers to implement
const ghostHelpers = {
  // URL helpers
  url: (context: any) => string,
  asset: (path: string) => string,
  
  // Content helpers
  content: (options: any) => string,
  excerpt: (options: any) => string,
  
  // Date helpers
  date: (date: string, format?: string) => string,
  
  // Iteration helpers
  foreach: (array: any[], options: any) => string,
  
  // Conditional helpers
  is: (context: string, options: any) => string,
  has: (context: string, options: any) => string,
  
  // Utility helpers
  encode: (string: string) => string,
  plural: (number: number, singular: string, plural: string) => string,
  
  // Navigation helpers
  navigation: (options: any) => string,
  
  // Meta helpers
  ghost_head: () => string,
  ghost_foot: () => string,
  
  // Pagination helpers
  pagination: (options: any) => string
}
```

## Implementation Strategy

### Phase 1: Core Template Engine (Weeks 1-3)

**Objectives:**
- Integrate Handlebars.js with Next.js
- Implement basic template rendering
- Create data model mapping layer

**Key Components:**
1. **Template Engine Service**
   ```typescript
   // pages/api/theme/render.ts
   export default async function handler(req: NextApiRequest, res: NextApiResponse) {
     const { template, context } = req.body
     const rendered = await themeEngine.render(template, context)
     res.json({ html: rendered })
   }
   ```

2. **Theme Route Handler**
   ```typescript
   // pages/blog/[...slug].tsx
   export async function getServerSideProps(context) {
     const { slug } = context.params
     const blog = await getBlogByDomain(context.req.headers.host)
     const theme = await getActiveTheme(blog.id)
     
     if (slug.length === 0) {
       // Homepage
       const posts = await getPosts(blog.id)
       const ghostContext = await buildIndexContext(posts, blog)
       const html = await renderTemplate(theme, 'index', ghostContext)
       return { props: { html, seo: extractSEO(ghostContext) } }
     }
     
     // Handle post/page routing
     // ...
   }
   ```

3. **Data Mapping Service**
   ```typescript
   class FromCafeToGhostMapper {
     mapPost(post: FromCafePost): GhostPost {
       return {
         id: post.id,
         title: post.title,
         slug: post.slug,
         html: post.content,
         plaintext: stripHtml(post.content),
         excerpt: post.excerpt,
         created_at: post.createdAt.toISOString(),
         updated_at: post.updatedAt.toISOString(),
         published_at: post.publishedAt?.toISOString(),
         url: `/${post.slug}`,
         tags: post.tags?.map(this.mapTag) || [],
         // ... other mappings
       }
     }
   }
   ```

### Phase 2: Theme Management System (Weeks 4-6)

**Objectives:**
- Theme upload and installation
- Theme validation and security checks
- Theme switching and configuration

**Key Components:**
1. **Theme Storage System**
   ```typescript
   interface ThemeStorage {
     uploadTheme(file: File, blogId: string): Promise<Theme>
     validateTheme(themePath: string): Promise<ValidationResult>
     installTheme(themeId: string, blogId: string): Promise<void>
     deleteTheme(themeId: string, blogId: string): Promise<void>
   }
   ```

2. **Theme Validation**
   ```typescript
   class ThemeValidator {
     async validateStructure(themePath: string): Promise<ValidationResult> {
       // Check required files exist
       // Validate package.json
       // Scan for security issues
       // Validate template syntax
     }
     
     async validateCompatibility(theme: Theme): Promise<CompatibilityReport> {
       // Check Ghost version compatibility
       // Validate helper usage
       // Check asset references
     }
   }
   ```

3. **Theme Configuration UI**
   ```typescript
   // Theme settings management
   interface ThemeSettings {
     [key: string]: {
       type: 'text' | 'color' | 'image' | 'boolean'
       default: any
       description: string
     }
   }
   ```

### Phase 3: Asset Management (Weeks 7-8)

**Objectives:**
- Theme asset serving and optimization
- CDN integration for performance
- Asset versioning and caching

**Key Components:**
1. **Asset Pipeline**
   ```typescript
   class ThemeAssetManager {
     async processAssets(theme: Theme): Promise<void> {
       // Minify CSS/JS
       // Optimize images
       // Generate asset manifests
       // Upload to CDN
     }
     
     getAssetUrl(theme: Theme, assetPath: string): string {
       // Return CDN URL or local URL
     }
   }
   ```

2. **Dynamic Asset Serving**
   ```typescript
   // pages/api/themes/[themeId]/assets/[...path].ts
   export default async function handler(req: NextApiRequest, res: NextApiResponse) {
     const { themeId, path } = req.query
     const asset = await getThemeAsset(themeId, path.join('/'))
     
     // Set appropriate headers
     res.setHeader('Content-Type', getMimeType(asset.path))
     res.setHeader('Cache-Control', 'public, max-age=31536000')
     
     res.send(asset.content)
   }
   ```

### Phase 4: Advanced Features (Weeks 9-12)

**Objectives:**
- Theme marketplace integration
- Advanced customization options
- Performance optimization

**Advanced Features:**
1. **Theme Marketplace**
2. **Custom CSS Injection**
3. **Theme Preview Mode**
4. **A/B Testing Support**
5. **Analytics Integration**

## Data Model Mapping

### FromCafe → Ghost Data Transformation

**Post Mapping:**
```typescript
const postMapping = {
  // Direct mappings
  id: 'id',
  title: 'title',
  slug: 'slug',
  content: 'html',
  excerpt: 'excerpt',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  publishedAt: 'published_at',
  
  // Computed fields
  plaintext: (post) => stripHtml(post.content),
  reading_time: (post) => calculateReadingTime(post.content),
  url: (post, blog) => `/${post.slug}`,
  feature_image: (post) => extractFeaturedImage(post.content),
  
  // Related data
  tags: (post) => post.tags?.map(mapTag) || [],
  authors: (post) => [mapAuthor(post.blog.user)],
  primary_author: (post) => mapAuthor(post.blog.user),
  primary_tag: (post) => post.tags?.[0] ? mapTag(post.tags[0]) : null
}
```

**Blog Settings Mapping:**
```typescript
const blogMapping = {
  title: 'title',
  description: 'description',
  url: (blog) => getBlogUrl(blog),
  timezone: () => 'UTC',
  lang: () => 'en',
  navigation: (blog) => buildNavigation(blog),
  
  // Theme-specific settings
  logo: (blog) => blog.settings?.logo || null,
  cover_image: (blog) => blog.settings?.coverImage || null,
  accent_color: (blog) => blog.settings?.accentColor || '#15171A',
  
  // Social media
  facebook: (blog) => blog.settings?.facebook || null,
  twitter: (blog) => blog.settings?.twitter || null,
}
```

## Template Engine Integration

### Handlebars Integration with Next.js

**Server-Side Rendering Approach:**
```typescript
// lib/theme-engine.ts
import Handlebars from 'handlebars'
import { readFileSync } from 'fs'
import { join } from 'path'

export class GhostThemeEngine {
  private handlebars: typeof Handlebars
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map()
  
  constructor() {
    this.handlebars = Handlebars.create()
    this.registerGhostHelpers()
  }
  
  async renderPage(
    themeId: string,
    template: string,
    context: GhostContext
  ): Promise<string> {
    const compiledTemplate = await this.getTemplate(themeId, template)
    return compiledTemplate(context)
  }
  
  private async getTemplate(
    themeId: string,
    templateName: string
  ): Promise<HandlebarsTemplateDelegate> {
    const cacheKey = `${themeId}:${templateName}`
    
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!
    }
    
    const templatePath = join(getThemePath(themeId), `${templateName}.hbs`)
    const templateSource = readFileSync(templatePath, 'utf-8')
    const compiled = this.handlebars.compile(templateSource)
    
    this.templateCache.set(cacheKey, compiled)
    return compiled
  }
}
```

**Context Building:**
```typescript
export class GhostContextBuilder {
  async buildContext(
    type: 'index' | 'post' | 'page' | 'tag' | 'author',
    data: any,
    blog: Blog
  ): Promise<GhostContext> {
    const baseContext = {
      blog: this.mapBlog(blog),
      @blog: this.mapBlog(blog),
      site: this.mapBlog(blog),
    }
    
    switch (type) {
      case 'index':
        return {
          ...baseContext,
          posts: data.posts.map(this.mapPost),
          pagination: this.buildPagination(data.pagination)
        }
      
      case 'post':
        return {
          ...baseContext,
          post: this.mapPost(data.post),
          related_posts: data.relatedPosts?.map(this.mapPost) || []
        }
      
      // ... other cases
    }
  }
}
```

## Asset Management

### Theme Asset Pipeline

**Asset Processing Strategy:**
```typescript
interface AssetPipeline {
  // CSS Processing
  processCSS(cssPath: string): Promise<ProcessedAsset>
  
  // JavaScript Processing  
  processJS(jsPath: string): Promise<ProcessedAsset>
  
  // Image Optimization
  optimizeImages(imagePaths: string[]): Promise<ProcessedAsset[]>
  
  // Asset Bundling
  createAssetManifest(theme: Theme): Promise<AssetManifest>
}

interface ProcessedAsset {
  originalPath: string
  processedPath: string
  hash: string
  size: number
  mimeType: string
}
```

**CDN Integration:**
```typescript
// Asset serving strategy
export const getAssetUrl = (theme: Theme, assetPath: string): string => {
  if (process.env.NODE_ENV === 'production') {
    return `${CDN_BASE_URL}/themes/${theme.id}/${assetPath}`
  }
  return `/api/themes/${theme.id}/assets/${assetPath}`
}

// Asset helper for templates
Handlebars.registerHelper('asset', function(assetPath: string) {
  const theme = this.theme
  return getAssetUrl(theme, assetPath)
})
```

## Theme Installation System

### Theme Package Structure

**Enhanced package.json for Ghost Compatibility:**
```json
{
  "name": "theme-name",
  "version": "1.0.0",
  "description": "A beautiful Ghost theme",
  "engines": {
    "ghost": ">=4.0.0",
    "ghost-api": "v4"
  },
  "keywords": ["ghost", "theme", "blog"],
  "config": {
    "posts_per_page": 10,
    "image_sizes": {
      "xs": 150,
      "s": 300,
      "m": 600,
      "l": 1000,
      "xl": 2000
    },
    "custom": {
      "accent_color": {
        "type": "color",
        "default": "#15171A",
        "description": "Primary accent color"
      },
      "show_author": {
        "type": "boolean", 
        "default": true,
        "description": "Show author information"
      }
    }
  }
}
```

**Theme Installation Process:**
```typescript
class ThemeInstaller {
  async installTheme(file: File, blogId: string): Promise<Theme> {
    // 1. Extract and validate
    const extractedPath = await this.extractTheme(file)
    const validation = await this.validateTheme(extractedPath)
    
    if (!validation.valid) {
      throw new Error(`Theme validation failed: ${validation.errors.join(', ')}`)
    }
    
    // 2. Process assets
    await this.processThemeAssets(extractedPath)
    
    // 3. Register theme
    const theme = await this.registerTheme(extractedPath, blogId)
    
    // 4. Compile templates
    await this.compileTemplates(theme)
    
    return theme
  }
  
  private async validateTheme(themePath: string): Promise<ValidationResult> {
    const required = ['index.hbs', 'post.hbs', 'package.json']
    const missing = required.filter(file => !existsSync(join(themePath, file)))
    
    if (missing.length > 0) {
      return { valid: false, errors: [`Missing required files: ${missing.join(', ')}`] }
    }
    
    // Additional validation...
    return { valid: true, errors: [] }
  }
}
```

## Security Considerations

### Template Security

**Handlebars Security Measures:**
```typescript
// Secure Handlebars configuration
const secureHandlebars = Handlebars.create()

// Disable dangerous features
secureHandlebars.registerHelper('lookup', () => {
  throw new Error('lookup helper disabled for security')
})

// Sanitize all string outputs
secureHandlebars.registerHelper('safe', (str: string) => {
  return new Handlebars.SafeString(DOMPurify.sanitize(str))
})

// Content Security Policy
const themeCSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"], // Controlled inline scripts only
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", "data:", "https:"],
  'font-src': ["'self'", "https:"],
}
```

**File Upload Security:**
```typescript
class ThemeSecurityValidator {
  async scanThemeForThreats(themePath: string): Promise<SecurityReport> {
    const threats: string[] = []
    
    // Scan for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/g,           // Node.js require()
      /process\./g,              // Process access
      /fs\./g,                   // File system access
      /__dirname/g,              // Directory access
      /eval\s*\(/g,              // Code evaluation
      /<script[^>]*src=/gi,      // External scripts
    ]
    
    for (const file of await this.getAllFiles(themePath)) {
      const content = await readFile(file, 'utf-8')
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          threats.push(`Suspicious pattern found in ${file}: ${pattern}`)
        }
      }
    }
    
    return { threats, safe: threats.length === 0 }
  }
}
```

## Performance Implications

### Rendering Performance

**Template Compilation Caching:**
```typescript
class TemplateCache {
  private cache = new Map<string, {
    template: HandlebarsTemplateDelegate,
    lastModified: number,
    size: number
  }>()
  
  private maxCacheSize = 100 * 1024 * 1024 // 100MB
  private currentCacheSize = 0
  
  async getTemplate(key: string, loader: () => Promise<HandlebarsTemplateDelegate>): Promise<HandlebarsTemplateDelegate> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!.template
    }
    
    const template = await loader()
    const size = this.estimateTemplateSize(template)
    
    if (this.currentCacheSize + size > this.maxCacheSize) {
      this.evictOldestTemplates()
    }
    
    this.cache.set(key, {
      template,
      lastModified: Date.now(),
      size
    })
    
    this.currentCacheSize += size
    return template
  }
}
```

**SSR Optimization:**
```typescript
// Optimized server-side rendering
export async function renderThemePage(
  blog: Blog,
  theme: Theme,
  context: GhostContext
): Promise<{ html: string, css: string, metadata: PageMetadata }> {
  
  // Parallel template and asset loading
  const [templateHtml, criticalCSS, metadata] = await Promise.all([
    themeEngine.render(theme, context),
    extractCriticalCSS(theme, context),
    buildPageMetadata(context)
  ])
  
  return {
    html: templateHtml,
    css: criticalCSS,
    metadata
  }
}
```

### Build-Time Optimizations

**Static Generation for Popular Themes:**
```typescript
// Pre-compile popular themes at build time
export async function precompileThemes() {
  const popularThemes = await getPopularThemes()
  
  for (const theme of popularThemes) {
    await compileThemeTemplates(theme)
    await optimizeThemeAssets(theme)
    await generateThemeMetadata(theme)
  }
}
```

## Migration Strategy

### Phase 1: Parallel System (Months 1-2)

**Dual Rendering Support:**
```typescript
// pages/blog/[...slug].tsx
export async function getServerSideProps(context) {
  const blog = await getBlogByDomain(context.req.headers.host)
  
  if (blog.themeType === 'ghost') {
    // Use Ghost theme engine
    return renderWithGhostTheme(blog, context)
  } else {
    // Use existing React rendering
    return renderWithReact(blog, context)
  }
}
```

**Gradual Migration Tools:**
```typescript
class ThemeMigrationService {
  async convertReactThemeToGhost(blogId: string): Promise<Theme> {
    // Extract theme settings from React components
    // Generate basic Ghost templates
    // Migrate custom CSS
    // Create package.json
  }
  
  async migrateCustomCSS(blogId: string): Promise<string> {
    // Convert React styled-components to CSS
    // Preserve custom modifications
    // Generate Ghost-compatible CSS
  }
}
```

### Phase 2: Theme Marketplace (Month 3)

**Theme Discovery and Installation:**
```typescript
interface ThemeMarketplace {
  searchThemes(query: string, filters: ThemeFilter[]): Promise<Theme[]>
  getThemeDetails(themeId: string): Promise<ThemeDetails>
  installTheme(themeId: string, blogId: string): Promise<void>
  previewTheme(themeId: string, blogId: string): Promise<string>
}

interface ThemeFilter {
  type: 'category' | 'price' | 'rating' | 'features'
  value: string | number
}
```

### Phase 3: Advanced Features (Month 4+)

**Custom Theme Builder:**
```typescript
interface ThemeBuilder {
  createThemeFromTemplate(templateId: string): Promise<Theme>
  customizeThemeColors(themeId: string, colors: ColorScheme): Promise<Theme>
  addCustomCSS(themeId: string, css: string): Promise<Theme>
  exportTheme(themeId: string): Promise<Blob>
}
```

## Business Considerations

### Revenue Opportunities

**Theme Marketplace Revenue:**
- Premium theme sales (30% commission)
- Theme customization services
- White-label theme development
- Enterprise theme packages

**Subscription Tiers:**
- **Free**: Basic Ghost themes + limited customization
- **Pro**: Premium themes + advanced customization + custom CSS
- **Business**: Theme marketplace access + priority support
- **Enterprise**: Custom theme development + dedicated support

### Market Positioning

**Competitive Advantages:**
- **Instant theme ecosystem**: 500+ themes available immediately
- **Lower barrier to entry**: No React knowledge required
- **Professional designs**: Battle-tested themes from Ghost community
- **SEO optimized**: Themes built for performance and search rankings

**Target Users:**
- **Bloggers**: Want professional designs without development skills
- **Small businesses**: Need quick, professional web presence
- **Agencies**: Can offer more design options to clients
- **Developers**: Can focus on content rather than theme development

### Implementation Costs

**Development Effort Estimation:**
- **Phase 1 (Core Engine)**: 8-12 weeks, 2-3 developers
- **Phase 2 (Theme Management)**: 6-8 weeks, 2 developers  
- **Phase 3 (Asset Pipeline)**: 4-6 weeks, 1-2 developers
- **Phase 4 (Marketplace)**: 8-10 weeks, 2-3 developers

**Infrastructure Costs:**
- **CDN for theme assets**: $50-200/month initially
- **Theme storage**: $20-100/month
- **Template compilation**: Minimal (serverless)
- **Marketplace hosting**: $100-500/month

**Ongoing Maintenance:**
- Theme compatibility updates
- Security monitoring
- Performance optimization
- User support for theme issues

### Risk Assessment

**Technical Risks:**
- **Performance impact**: Server-side rendering overhead
- **Security vulnerabilities**: Template injection attacks
- **Complexity**: Maintaining two rendering systems
- **Compatibility**: Ghost theme updates breaking compatibility

**Mitigation Strategies:**
- Comprehensive template caching
- Strict template validation and sandboxing
- Gradual migration with fallback systems
- Version pinning and compatibility testing

**Business Risks:**
- **Development timeline**: Complex implementation
- **User adoption**: Learning curve for theme management
- **Competition**: Ghost could restrict theme usage
- **Legal issues**: Theme licensing and ownership

**Success Metrics:**
- Theme adoption rate (>50% of users within 6 months)
- Performance maintenance (<100ms overhead)
- Theme marketplace revenue ($10k+ monthly within 12 months)
- User satisfaction (>4.5/5 rating for theme system)

## Conclusion

Implementing Ghost-compatible theme support would significantly enhance FromCafe's value proposition by providing immediate access to a mature ecosystem of professional themes. While technically complex, the implementation is feasible and would differentiate FromCafe in the blogging platform market.

The phased approach allows for gradual implementation while maintaining existing functionality, and the business model provides multiple revenue streams to justify the development investment.

**Key Success Factors:**
1. **Performance**: Maintain fast rendering despite template engine overhead
2. **Security**: Robust validation and sandboxing of user-uploaded themes
3. **Compatibility**: High fidelity Ghost theme rendering
4. **User Experience**: Simple theme installation and customization
5. **Ecosystem**: Active theme marketplace with quality themes

This implementation would position FromCafe as a unique platform combining Evernote integration with the rich Ghost theme ecosystem, creating a compelling offering for content creators seeking both functionality and design flexibility.

---

*Document Version: 1.0*  
*Last Updated: July 2, 2025*  
*Estimated Implementation: 6-8 months*  
*Priority: Medium-High (Post Multi-Tenant Launch)*