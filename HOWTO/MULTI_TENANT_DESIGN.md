# Multi-Tenant Blogging Platform Design: FromCafe Evolution

## Executive Summary

This document outlines the architectural design for transforming FromCafe from a single-user Evernote blog into a multi-tenant blogging platform supporting custom domains. The design leverages Vercel's infrastructure to enable users to connect their own domain names (e.g., `myblog.com`) while maintaining scalability and performance.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Design Overview](#design-overview)
3. [Technical Architecture](#technical-architecture)
4. [Implementation Plan](#implementation-plan)
5. [Vercel-Specific Solutions](#vercel-specific-solutions)
6. [Database Design](#database-design)
7. [User Experience Design](#user-experience-design)
8. [Security Considerations](#security-considerations)
9. [Migration Strategy](#migration-strategy)
10. [Business Considerations](#business-considerations)

## Problem Statement

### Current State
- Single-user Evernote blog integration
- Fixed domain structure (`fromcafe.vercel.app`)
- One user, one blog model

### Target State
- Multi-tenant blogging platform
- Support for custom domains (`myblog.com` → user's blog)
- Subdomain support (`username.fromcafe.com`)
- Scalable architecture for thousands of users
- Maintained performance and security

### Core Requirements
1. **Custom Domain Support**: Users can connect `myblog.com` to their blog
2. **Subdomain Support**: Default `username.fromcafe.com` subdomains
3. **Multi-Tenant Architecture**: Isolated user content and data
4. **Vercel Deployment**: Single deployment handling all domains
5. **SSL Management**: Automatic SSL certificates for all domains
6. **Domain Verification**: Ensure users own domains they're adding

## Design Overview

### Domain Resolution Strategy

We propose a **hybrid approach** supporting three domain patterns:

```
1. Custom Domains:     myblog.com → User's Blog
2. Subdomains:         username.fromcafe.com → User's Blog  
3. Path-based Fallback: fromcafe.com/blog/username → User's Blog
```

### Request Flow Architecture

```
Incoming Request
    ↓
Domain Detection (Middleware)
    ↓
Blog Resolution (Database/Edge Config)
    ↓
Content Serving (Dynamic Routing)
    ↓
User's Blog Content
```

### High-Level Components

1. **Domain Detection System**: Identifies which blog to serve based on hostname
2. **Blog Resolution Engine**: Maps domains/subdomains to specific blogs
3. **Multi-Tenant Routing**: Serves appropriate content for each blog
4. **Domain Management System**: Handles custom domain setup and verification
5. **Content Isolation**: Ensures secure separation between blogs

## Technical Architecture

### 1. Domain Detection System

The system uses Next.js middleware to detect and route requests based on the incoming hostname:

```typescript
// Conceptual middleware flow
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')
  
  if (hostname.endsWith('.fromcafe.com')) {
    // Subdomain pattern: extract username
    const subdomain = hostname.replace('.fromcafe.com', '')
    if (subdomain !== 'www' && subdomain !== '') {
      return rewriteToBlog(subdomain)
    }
  } else if (await isCustomDomain(hostname)) {
    // Custom domain: lookup blog mapping
    const blogSlug = await getCustomDomainMapping(hostname)
    return rewriteToBlog(blogSlug)
  }
  
  // Default: main platform
  return NextResponse.next()
}
```

### 2. Blog Resolution Engine

Two-tier resolution system for performance:

**Tier 1: Edge Config (Fast Lookup)**
```typescript
// Edge Config for custom domains
{
  "myblog.com": "john-doe",
  "techstuff.io": "jane-smith", 
  "startup-blog.com": "startup-co"
}
```

**Tier 2: Database (Authoritative)**
```typescript
// Database verification and fallback
const blog = await prisma.blog.findUnique({
  where: { 
    OR: [
      { customDomain: hostname },
      { slug: subdomain }
    ]
  },
  include: { user: true, posts: true }
})
```

### 3. Multi-Tenant Routing

Dynamic routing structure:

```
URL Rewriting:
myblog.com/post/hello → /blog/[slug]/post/[postSlug]
username.fromcafe.com → /blog/[slug]
fromcafe.com/blog/username → /blog/[slug]
```

### 4. Content Serving Architecture

```typescript
// Dynamic blog page structure
pages/
├── blog/
│   └── [slug]/
│       ├── index.tsx           // Blog home
│       ├── post/
│       │   └── [postSlug].tsx  // Individual posts
│       ├── about.tsx           // About page
│       └── archive.tsx         // Post archive
├── dashboard/                  // Admin interface
└── api/                       // API routes
```

## Implementation Plan

### Phase 1: Multi-Tenant Foundation (Weeks 1-2)

**Objectives:**
- Transform single-user to multi-user system
- Implement basic blog isolation
- Add user-blog relationship management

**Tasks:**
1. Database schema migration for multi-tenancy
2. User management system enhancement
3. Blog creation and management UI
4. Basic subdomain routing (`username.fromcafe.com`)

**Deliverables:**
- Multiple users can create blogs
- Each blog accessible via subdomain
- Isolated content and settings per blog

### Phase 2: Domain Management System (Weeks 3-4)

**Objectives:**
- Implement custom domain support
- Build domain verification system
- Integrate with Vercel Domains API

**Tasks:**
1. Domain management UI and database schema
2. Vercel API integration for domain addition
3. DNS verification system
4. SSL certificate automation

**Deliverables:**
- Users can add custom domains
- Automated domain verification
- SSL certificates for custom domains

### Phase 3: Advanced Routing & Performance (Weeks 5-6)

**Objectives:**
- Optimize domain resolution performance
- Implement Edge Config for fast lookups
- Add advanced routing features

**Tasks:**
1. Edge Config integration for domain mapping
2. Performance optimization and caching
3. Advanced routing features (redirects, aliases)
4. Error handling and fallback systems

**Deliverables:**
- Sub-100ms domain resolution
- Robust error handling
- Advanced domain features

### Phase 4: Polish & Scale (Weeks 7-8)

**Objectives:**
- Production readiness
- Monitoring and analytics
- Documentation and support

**Tasks:**
1. Comprehensive testing across domain types
2. Monitoring and alerting setup
3. User documentation and guides
4. Performance optimization and scaling prep

**Deliverables:**
- Production-ready multi-tenant platform
- Complete documentation
- Monitoring and support systems

## Vercel-Specific Solutions

### 1. Wildcard Domain Configuration

**DNS Setup:**
```
Type: CNAME
Name: *
Value: cname.vercel-dns.com
TTL: 3600
```

**Vercel Project Configuration:**
- Add `*.fromcafe.com` as project domain
- Configure wildcard SSL certificate
- Enable automatic SSL for custom domains

### 2. Vercel Domains API Integration

**Domain Addition Service:**
```typescript
class VercelDomainService {
  private vercelAPI = new VercelAPI(process.env.VERCEL_TOKEN)
  
  async addCustomDomain(domain: string, blogId: string) {
    try {
      // Add domain to Vercel project
      await this.vercelAPI.post('/v10/projects/PROJECT_ID/domains', {
        name: domain
      })
      
      // Store in database
      await prisma.domain.create({
        data: {
          domain,
          blogId,
          verificationStatus: 'pending'
        }
      })
      
      // Update Edge Config for routing
      await this.updateEdgeConfig(domain, blogSlug)
      
      return { success: true, domain }
    } catch (error) {
      console.error('Domain addition failed:', error)
      throw new Error('Failed to add domain')
    }
  }
  
  async verifyDomain(domain: string) {
    const verification = await this.vercelAPI.get(`/v9/projects/PROJECT_ID/domains/${domain}`)
    
    await prisma.domain.update({
      where: { domain },
      data: { 
        verificationStatus: verification.verified ? 'verified' : 'pending',
        dnsRecords: verification.configuredBy === 'CNAME' ? verification.cname : verification.aRecords
      }
    })
    
    return verification
  }
}
```

### 3. Edge Config for Performance

**Configuration Structure:**
```typescript
// Edge Config: domain-to-blog mapping
interface EdgeConfigSchema {
  [domain: string]: {
    blogSlug: string;
    userId: string;
    lastUpdated: string;
  }
}

// Usage in middleware
import { get } from '@vercel/edge-config'

const blogInfo = await get(hostname)
if (blogInfo) {
  return NextResponse.rewrite(new URL(`/blog/${blogInfo.blogSlug}${pathname}`, request.url))
}
```

### 4. SSL Certificate Management

**Automatic SSL Features:**
- Vercel automatically provisions SSL certificates for custom domains
- Supports wildcard certificates for subdomains
- Automatic renewal and management
- No manual certificate configuration required

## Database Design

### Enhanced Schema

```sql
-- Users (existing, minimal changes)
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String?
  image                 String?
  
  -- OAuth data (existing)
  accounts              Account[]
  sessions              Session[]
  evernoteToken         String?  @db.Text
  evernoteTokenSecret   String?  @db.Text
  evernoteNoteStoreUrl  String?
  
  -- Multi-tenant additions
  blogs                 Blog[]
  subscription          Subscription?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

-- Blogs (enhanced for multi-tenancy)
model Blog {
  id                    String   @id @default(cuid())
  userId                String
  
  -- Blog identity
  title                 String
  description           String?
  slug                  String   @unique  -- Used for subdomains
  
  -- Domain configuration
  customDomain          String?  @unique
  subdomainEnabled      Boolean  @default(true)
  domainVerified        Boolean  @default(false)
  
  -- Blog settings
  theme                 String   @default("default")
  customCSS             String?  @db.Text
  customHTML            String?  @db.Text
  
  -- Publishing settings
  isPublic              Boolean  @default(true)
  passwordProtected     Boolean  @default(false)
  password              String?
  
  -- Evernote integration (existing)
  evernoteNotebook      String?
  evernoteWebhookId     String?
  lastSyncedAt          DateTime?
  lastSyncAttemptAt     DateTime?
  lastSyncUpdateCount   Int?
  
  -- Relations
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  posts                 Post[]
  domains               Domain[]
  analytics             Analytics[]
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@index([userId])
  @@index([customDomain])
  @@index([slug])
}

-- Domain management
model Domain {
  id                    String   @id @default(cuid())
  domain                String   @unique
  blogId                String
  
  -- Verification status
  verificationStatus    String   @default("pending") // pending, verified, failed
  dnsRecords            Json?    -- Required DNS records
  verifiedAt            DateTime?
  
  -- Configuration
  redirectToWWW         Boolean  @default(false)
  forceSSL              Boolean  @default(true)
  
  blog                  Blog     @relation(fields: [blogId], references: [id], onDelete: Cascade)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@index([blogId])
  @@index([verificationStatus])
}

-- Posts (enhanced with multi-tenant context)
model Post {
  id                    String   @id @default(cuid())
  blogId                String   -- Added for multi-tenancy
  
  -- Post content (existing)
  title                 String
  content               String?  @db.Text
  excerpt               String?
  slug                  String
  
  -- Publishing (existing)
  isPublished           Boolean  @default(false)
  publishedAt           DateTime?
  
  -- Evernote integration (existing)
  evernoteNoteId        String?  @unique
  
  -- Multi-tenant additions
  authorId              String?  -- For multi-author blogs
  
  blog                  Blog     @relation(fields: [blogId], references: [id], onDelete: Cascade)
  author                User?    @relation(fields: [authorId], references: [id])
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([blogId, slug])
  @@index([blogId, isPublished])
  @@index([evernoteNoteId])
}

-- Subscription management
model Subscription {
  id                    String   @id @default(cuid())
  userId                String   @unique
  
  plan                  String   -- free, pro, enterprise
  status                String   -- active, canceled, past_due
  
  -- Limits
  maxBlogs              Int      @default(1)
  maxCustomDomains      Int      @default(0)
  customThemes          Boolean  @default(false)
  analytics             Boolean  @default(false)
  
  -- Billing
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

-- Analytics (optional)
model Analytics {
  id                    String   @id @default(cuid())
  blogId                String
  
  date                  DateTime @db.Date
  pageViews             Int      @default(0)
  uniqueVisitors        Int      @default(0)
  
  blog                  Blog     @relation(fields: [blogId], references: [id], onDelete: Cascade)
  
  @@unique([blogId, date])
  @@index([blogId, date])
}
```

### Migration Strategy

```sql
-- Migration steps from current schema
BEGIN TRANSACTION;

-- 1. Add multi-tenancy to blogs
ALTER TABLE "Blog" ADD COLUMN "slug" TEXT;
ALTER TABLE "Blog" ADD COLUMN "customDomain" TEXT;
ALTER TABLE "Blog" ADD COLUMN "subdomainEnabled" BOOLEAN DEFAULT true;
ALTER TABLE "Blog" ADD COLUMN "domainVerified" BOOLEAN DEFAULT false;

-- 2. Create unique slugs for existing blogs
UPDATE "Blog" SET "slug" = 'user-' || "userId" WHERE "slug" IS NULL;

-- 3. Add constraints
ALTER TABLE "Blog" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Blog_slug_key" ON "Blog"("slug");
CREATE UNIQUE INDEX "Blog_customDomain_key" ON "Blog"("customDomain");

-- 4. Add blogId to posts for multi-tenancy
ALTER TABLE "Post" ADD COLUMN "blogId" TEXT;

-- 5. Populate blogId for existing posts
UPDATE "Post" SET "blogId" = (
  SELECT "id" FROM "Blog" WHERE "Blog"."userId" = 
    (SELECT "userId" FROM "Blog" LIMIT 1)
) WHERE "blogId" IS NULL;

-- 6. Make blogId required and add foreign key
ALTER TABLE "Post" ALTER COLUMN "blogId" SET NOT NULL;
ALTER TABLE "Post" ADD FOREIGN KEY ("blogId") REFERENCES "Blog"("id");

-- 7. Create new tables
CREATE TABLE "Domain" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "domain" TEXT NOT NULL UNIQUE,
  "blogId" TEXT NOT NULL,
  "verificationStatus" TEXT DEFAULT 'pending',
  "dnsRecords" TEXT,
  "verifiedAt" TIMESTAMP,
  "redirectToWWW" BOOLEAN DEFAULT false,
  "forceSSL" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE
);

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "status" TEXT NOT NULL DEFAULT 'active',
  "maxBlogs" INTEGER DEFAULT 1,
  "maxCustomDomains" INTEGER DEFAULT 0,
  "customThemes" BOOLEAN DEFAULT false,
  "analytics" BOOLEAN DEFAULT false,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

COMMIT;
```

## User Experience Design

### 1. Blog Creation Flow

**Step 1: Choose Blog Slug**
```
┌─────────────────────────────────────┐
│ Create Your Blog                    │
├─────────────────────────────────────┤
│ Blog Name: [My Awesome Blog      ]  │
│ URL Slug:  [my-awesome-blog      ]  │
│                                     │
│ Your blog will be available at:     │
│ https://my-awesome-blog.fromcafe.com│
│                                     │
│ [ Continue ]                        │
└─────────────────────────────────────┘
```

**Step 2: Configure Blog**
```
┌─────────────────────────────────────┐
│ Blog Configuration                  │
├─────────────────────────────────────┤
│ Description: [A blog about...]      │
│ Theme: [Default ▼]                  │
│ Visibility: ○ Public ● Private      │
│                                     │
│ Evernote Integration:               │
│ ☐ Connect Evernote Notebook         │
│                                     │
│ [ Create Blog ]                     │
└─────────────────────────────────────┘
```

### 2. Domain Management Interface

**Custom Domain Setup**
```
┌─────────────────────────────────────┐
│ Custom Domain Settings              │
├─────────────────────────────────────┤
│ Current: my-blog.fromcafe.com       │
│                                     │
│ Custom Domain:                      │
│ [myblog.com                    ]    │
│                                     │
│ ⚠️  DNS Configuration Required       │
│                                     │
│ Add this CNAME record to your DNS:  │
│ Name: @                             │
│ Value: cname.vercel-dns.com         │
│                                     │
│ Status: ⏳ Pending Verification      │
│                                     │
│ [ Check Verification ]              │
└─────────────────────────────────────┘
```

**Domain Status Dashboard**
```
┌─────────────────────────────────────┐
│ Domain Status                       │
├─────────────────────────────────────┤
│ ✅ myblog.com                       │
│    Status: Active                   │
│    SSL: Valid until Dec 2025        │
│                                     │
│ ⏳ blog.example.com                  │
│    Status: Pending DNS              │
│    Added: 2 hours ago               │
│                                     │
│ [ + Add Domain ]                    │
└─────────────────────────────────────┘
```

### 3. Blog Dashboard

**Multi-Blog Management**
```
┌─────────────────────────────────────┐
│ Your Blogs                          │
├─────────────────────────────────────┤
│ 📝 My Tech Blog                     │
│    myblog.com • 24 posts            │
│    Last sync: 2 hours ago           │
│    [ Manage ] [ View ]              │
│                                     │
│ 📝 Travel Stories                   │
│    travel.fromcafe.com • 12 posts   │
│    Last sync: 1 day ago             │
│    [ Manage ] [ View ]              │
│                                     │
│ [ + Create New Blog ]               │
└─────────────────────────────────────┘
```

### 4. Theme and Customization

**Theme Selection**
```
┌─────────────────────────────────────┐
│ Customize Your Blog                 │
├─────────────────────────────────────┤
│ Theme:                              │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│ │Min │ │Tech│ │Blog│ │News│        │
│ │ ✓  │ │    │ │    │ │ 💎 │        │
│ └────┘ └────┘ └────┘ └────┘        │
│                                     │
│ Custom CSS: (Pro Feature)           │
│ ┌─────────────────────────────────┐ │
│ │ /* Add your custom styles */    │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [ Save Changes ]                    │
└─────────────────────────────────────┘
```

## Security Considerations

### 1. Domain Verification Security

**Prevention of Domain Hijacking:**
- DNS-based verification using TXT records
- Rate limiting on domain addition attempts (5 domains per hour per user)
- Domain ownership verification through DNS challenge
- Audit trail for all domain operations

**Verification Process:**
```typescript
// Domain verification flow
async function verifyDomainOwnership(domain: string, userId: string) {
  // Generate verification token
  const verificationToken = generateSecureToken()
  
  // Store verification challenge
  await prisma.domainVerification.create({
    data: {
      domain,
      userId,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }
  })
  
  // Instruct user to add TXT record
  return {
    txtRecord: {
      name: `_fromcafe-verification.${domain}`,
      value: verificationToken
    }
  }
}
```

### 2. Content Isolation

**Multi-Tenant Security:**
- All database queries scoped to user/blog context
- Middleware-level access control
- No cross-blog data access
- Secure admin interface separation

**Example Secure Query Pattern:**
```typescript
// Always include user/blog context in queries
async function getUserPost(postSlug: string, userId: string, blogId: string) {
  return await prisma.post.findFirst({
    where: {
      slug: postSlug,
      blog: {
        id: blogId,
        userId: userId  // Ensure user owns the blog
      }
    }
  })
}
```

### 3. SSL and HTTPS Enforcement

**Security Headers:**
```typescript
// Security headers for all domains
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}
```

**HTTPS Enforcement:**
- Automatic HTTPS redirects for all custom domains
- HSTS headers to prevent downgrade attacks
- Secure cookie configuration

### 4. Rate Limiting and Abuse Prevention

**Domain Management Rate Limits:**
- 5 domain additions per hour per user
- 20 verification attempts per domain per day
- Progressive delays for failed attempts

**API Rate Limiting:**
```typescript
// Rate limiting configuration
const rateLimits = {
  domainAddition: { requests: 5, window: '1h' },
  domainVerification: { requests: 20, window: '1d' },
  blogCreation: { requests: 3, window: '1h' },
  postPublishing: { requests: 100, window: '1h' }
}
```

## Migration Strategy

### Phase 1: Data Migration (Week 1)

**Objectives:**
- Migrate existing single-user data to multi-tenant structure
- Ensure zero downtime during migration
- Preserve all existing functionality

**Steps:**
1. **Schema Migration:**
   - Add multi-tenant columns to existing tables
   - Create new tables (Domain, Subscription)
   - Populate data for existing users

2. **Data Transformation:**
   - Convert single blog to user-owned blog
   - Generate unique slugs for existing blogs
   - Maintain all existing Evernote integrations

3. **Backward Compatibility:**
   - Ensure existing URLs continue to work
   - Maintain current authentication flows
   - Preserve all user settings and data

### Phase 2: Subdomain Implementation (Week 2)

**Objectives:**
- Implement subdomain routing
- Test multi-tenant functionality
- Launch subdomain feature

**Steps:**
1. **DNS Configuration:**
   - Set up wildcard domain (`*.fromcafe.com`)
   - Configure SSL certificates
   - Test subdomain resolution

2. **Routing Implementation:**
   - Deploy middleware for subdomain detection
   - Implement blog resolution logic
   - Test cross-blog isolation

3. **User Interface:**
   - Launch blog creation interface
   - Enable subdomain selection
   - Test user flows

### Phase 3: Custom Domain Beta (Week 3-4)

**Objectives:**
- Launch custom domain feature in beta
- Test domain verification system
- Gather user feedback

**Steps:**
1. **Domain System Launch:**
   - Deploy domain management interface
   - Integrate Vercel Domains API
   - Launch verification system

2. **Beta Testing:**
   - Invite select users to test custom domains
   - Monitor system performance
   - Collect feedback and iterate

3. **Performance Optimization:**
   - Implement Edge Config for fast lookups
   - Optimize domain resolution performance
   - Add monitoring and alerting

### Phase 4: Full Production (Week 5-6)

**Objectives:**
- Launch custom domains for all users
- Implement subscription tiers
- Scale for production load

**Steps:**
1. **Production Launch:**
   - Open custom domains to all users
   - Launch subscription plans
   - Implement usage limits

2. **Monitoring and Support:**
   - Deploy comprehensive monitoring
   - Create user documentation
   - Set up support systems

3. **Performance and Scale:**
   - Optimize for scale
   - Implement caching strategies
   - Prepare for growth

## Business Considerations

### 1. Pricing Strategy

**Subscription Tiers:**

**Free Tier:**
- 1 blog per user
- Subdomain only (`username.fromcafe.com`)
- Basic themes
- Evernote integration
- Up to 100 posts

**Pro Tier ($9/month):**
- 3 blogs per user
- 1 custom domain per blog
- Custom themes and CSS
- Blog analytics
- Unlimited posts
- Priority support

**Business Tier ($29/month):**
- 10 blogs per user
- 5 custom domains per blog
- White-label options
- Advanced analytics
- Team collaboration
- Custom integrations

**Enterprise Tier (Custom):**
- Unlimited blogs and domains
- Custom themes and development
- Dedicated support
- SLA guarantees
- Custom integrations

### 2. Technical Limitations

**Vercel Constraints:**
- Domain limit per project (100 domains)
- Function execution limits
- Bandwidth considerations
- Edge Config size limits

**Scaling Solutions:**
- Multi-project architecture for enterprise clients
- Domain pooling strategies
- CDN optimization for static assets
- Database read replicas for scale

### 3. Support and Documentation

**User Documentation:**
- Domain setup guides with screenshots
- DNS configuration tutorials
- Troubleshooting common issues
- Video tutorials for complex setups

**Technical Support:**
- Automated domain verification status
- Clear error messages with solutions
- Support ticket system integration
- Community forums for user help

### 4. Analytics and Monitoring

**Domain Performance Monitoring:**
```typescript
// Monitoring metrics
const metrics = {
  domainResolutionTime: 'avg_domain_lookup_ms',
  sslCertificateStatus: 'ssl_cert_validity',
  domainVerificationRate: 'verification_success_rate',
  userSatisfactionScore: 'domain_setup_completion_rate'
}
```

**Business Metrics:**
- Custom domain adoption rate
- Subscription conversion from free to paid
- Domain verification success rate
- Support ticket volume by domain issues

## Technical Implementation Details

### 1. Middleware Implementation

```typescript
// middleware.ts - Complete implementation
import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/edge-config'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const { pathname } = request.nextUrl
  
  // Skip middleware for API routes and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }
  
  // Handle main domain (dashboard, auth, etc.)
  if (hostname === 'fromcafe.com' || hostname === 'www.fromcafe.com') {
    return NextResponse.next()
  }
  
  // Handle subdomains
  if (hostname.endsWith('.fromcafe.com')) {
    const subdomain = hostname.replace('.fromcafe.com', '')
    
    // Skip www and other system subdomains
    if (['www', 'api', 'admin'].includes(subdomain)) {
      return NextResponse.next()
    }
    
    // Rewrite to blog page
    return NextResponse.rewrite(
      new URL(`/blog/${subdomain}${pathname}`, request.url)
    )
  }
  
  // Handle custom domains
  try {
    const blogSlug = await get(hostname)
    if (blogSlug) {
      return NextResponse.rewrite(
        new URL(`/blog/${blogSlug}${pathname}`, request.url)
      )
    }
  } catch (error) {
    console.error('Edge Config lookup failed:', error)
  }
  
  // Fallback to database lookup for custom domains
  const url = new URL('/api/resolve-domain', request.url)
  url.searchParams.set('hostname', hostname)
  url.searchParams.set('pathname', pathname)
  
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.blogSlug) {
      return NextResponse.rewrite(
        new URL(`/blog/${data.blogSlug}${pathname}`, request.url)
      )
    }
  } catch (error) {
    console.error('Database domain lookup failed:', error)
  }
  
  // Domain not found - show 404
  return NextResponse.rewrite(new URL('/404', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

### 2. Domain Resolution API

```typescript
// pages/api/resolve-domain.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { hostname } = req.query
  
  if (!hostname || typeof hostname !== 'string') {
    return res.status(400).json({ error: 'Hostname required' })
  }
  
  try {
    // Look up custom domain
    const domain = await prisma.domain.findUnique({
      where: { 
        domain: hostname,
        verificationStatus: 'verified'
      },
      include: {
        blog: {
          select: { slug: true, isPublic: true }
        }
      }
    })
    
    if (domain && domain.blog.isPublic) {
      return res.json({ blogSlug: domain.blog.slug })
    }
    
    // Look up by custom domain in blog table (legacy)
    const blog = await prisma.blog.findUnique({
      where: { 
        customDomain: hostname,
        domainVerified: true,
        isPublic: true
      },
      select: { slug: true }
    })
    
    if (blog) {
      return res.json({ blogSlug: blog.slug })
    }
    
    return res.status(404).json({ error: 'Domain not found' })
  } catch (error) {
    console.error('Domain resolution error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

### 3. Blog Page Component

```typescript
// pages/blog/[slug]/index.tsx
import { GetServerSideProps } from 'next'
import { prisma } from '@/lib/prisma'
import BlogLayout from '@/components/BlogLayout'
import PostList from '@/components/PostList'

interface BlogPageProps {
  blog: {
    id: string
    title: string
    description: string
    theme: string
    customCSS?: string
  }
  posts: Array<{
    id: string
    title: string
    excerpt: string
    slug: string
    publishedAt: string
  }>
}

export default function BlogPage({ blog, posts }: BlogPageProps) {
  return (
    <BlogLayout blog={blog}>
      <PostList posts={posts} />
    </BlogLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { slug } = context.params!
  
  try {
    const blog = await prisma.blog.findUnique({
      where: { 
        slug: slug as string,
        isPublic: true
      },
      include: {
        posts: {
          where: { isPublished: true },
          orderBy: { publishedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            excerpt: true,
            slug: true,
            publishedAt: true
          }
        }
      }
    })
    
    if (!blog) {
      return { notFound: true }
    }
    
    return {
      props: {
        blog: {
          id: blog.id,
          title: blog.title,
          description: blog.description,
          theme: blog.theme,
          customCSS: blog.customCSS
        },
        posts: blog.posts.map(post => ({
          ...post,
          publishedAt: post.publishedAt?.toISOString() || ''
        }))
      }
    }
  } catch (error) {
    console.error('Error loading blog:', error)
    return { notFound: true }
  }
}
```

## Conclusion

This design provides a comprehensive roadmap for transforming FromCafe into a scalable multi-tenant blogging platform with custom domain support. The architecture leverages Vercel's strengths while addressing the complexities of domain management, security, and multi-tenancy.

### Key Benefits

1. **Scalable Architecture**: Supports thousands of users and domains
2. **Vercel Integration**: Leverages Vercel's domain and SSL infrastructure
3. **User Experience**: Simple domain setup with clear verification process
4. **Security**: Robust domain verification and content isolation
5. **Performance**: Edge-optimized domain resolution
6. **Business Model**: Clear subscription tiers driving revenue

### Success Metrics

- **Technical**: Sub-100ms domain resolution, 99.9% uptime
- **User**: 80%+ domain verification success rate, <5 support tickets per 100 domains
- **Business**: 20%+ conversion from free to paid, 50%+ custom domain adoption

This design positions FromCafe as a competitive blogging platform while maintaining the unique Evernote integration that differentiates it from other solutions.

---

*Document Version: 1.0*  
*Last Updated: July 2, 2025*  
*Author: Technical Architecture Team*