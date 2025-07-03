# Multi-Tenant Architecture Implementation Plan

## Overview

This document outlines the implementation plan for converting fromcafe from a single-tenant to a multi-tenant blogging platform, allowing users to create blogs on custom subdomains (e.g., `john.from.cafe`) and connect their own top-level domains.

## Research Summary

### Vercel Platforms Starter Kit Analysis
- **Architecture**: Subdomain-based multi-tenancy with middleware routing
- **Database**: Uses Redis for tenant data with `subdomain:{name}` key pattern
- **Routing**: Dynamic middleware handles tenant detection and routing
- **Features**: Custom domain support, tenant-specific branding, admin interfaces

### Vercel Domain Management
- **Wildcard Domains**: Point to Vercel nameservers (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`)
- **Programmatic Domain Addition**: Use Vercel SDK with `projectsAddProjectDomain`
- **Domain Verification**: Automatic SSL certificate generation and TXT record validation
- **Custom Domain Flow**: Provision → Verify → Route → SSL

## Current Architecture Analysis

### Database Schema (Single-Tenant)
```
User (1) → (N) Blog (1) → (N) Post
User (1) → (N) Domain (1) → (1) Blog
```

**Key Limitations:**
- Global unique constraints (blog slugs, domains)
- User-centric data access only
- No tenant isolation
- Single database instance

### Routing System
- **Current**: `/blog/[slug]` and `/blog/[slug]/[postSlug]`
- **Middleware**: Disabled due to Prisma Edge Runtime conflicts
- **Domain Handling**: Domains stored but not actively routed

## Multi-Tenant Architecture Design

### 1. Database Schema Changes

#### Add Tenant Entity
```prisma
model Tenant {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  domain      String?  @unique
  subdomain   String?  @unique
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  users       TenantUser[]
  blogs       Blog[]
  domains     Domain[]
  
  @@map("tenants")
}
```

#### Tenant-User Relationship
```prisma
model TenantUser {
  id       String     @id @default(cuid())
  userId   String
  tenantId String
  role     TenantRole @default(MEMBER)
  
  user     User   @relation(fields: [userId], references: [id])
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  
  @@unique([userId, tenantId])
  @@map("tenant_users")
}

enum TenantRole {
  OWNER
  ADMIN
  MEMBER
}
```

#### Updated Blog Model
```prisma
model Blog {
  // ... existing fields
  tenantId    String
  tenant      Tenant @relation(fields: [tenantId], references: [id])
  
  // Tenant-scoped unique constraints
  @@unique([tenantId, slug])
  @@map("blogs")
}
```

### 2. Routing Architecture

#### Middleware Implementation
```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')
  const pathname = request.nextUrl.pathname
  
  // Parse tenant from hostname
  const tenant = await getTenantFromHostname(hostname)
  
  if (tenant) {
    // Rewrite to tenant-specific routes
    const url = request.nextUrl.clone()
    url.pathname = `/tenant/${tenant.slug}${pathname}`
    return NextResponse.rewrite(url)
  }
  
  return NextResponse.next()
}
```

#### Route Structure
```
src/app/
├── tenant/
│   └── [tenantSlug]/
│       ├── page.tsx              # Tenant home
│       ├── blog/
│       │   └── [slug]/
│       │       ├── page.tsx      # Blog home
│       │       └── [postSlug]/
│       │           └── page.tsx  # Post page
│       └── dashboard/
│           └── page.tsx          # Tenant admin
├── blog/[slug]/                  # Legacy support
└── dashboard/                    # Legacy support
```

### 3. Domain Management System

#### Domain Types
- **Subdomain**: `tenant.from.cafe`
- **Custom Domain**: `tenant.com`
- **Wildcard Support**: `*.from.cafe`

#### Domain Verification Flow
1. User adds domain to tenant
2. System generates verification TXT record
3. User adds TXT record to DNS
4. System verifies domain ownership
5. Automatic SSL certificate provisioning
6. Domain activation

#### Vercel Integration
```typescript
// src/lib/vercel-domains.ts
export class VercelDomainService {
  async addDomain(domain: string, tenantId: string) {
    // Add domain to Vercel project
    await projectsAddProjectDomain(vercel, {
      idOrName: 'fromcafe',
      requestBody: { name: domain }
    })
    
    // Store domain record
    await prisma.domain.create({
      data: { domain, tenantId, isVerified: false }
    })
  }
}
```

## Implementation Strategy

### Phase 1: Database Migration (Week 1)
1. **Add tenant models** to schema
2. **Create migration scripts** for existing data
3. **Test migration** on development database
4. **Update all queries** to be tenant-scoped

### Phase 2: Routing Infrastructure (Week 2)
1. **Implement tenant-aware middleware**
2. **Create tenant-specific route handlers**
3. **Update authentication** to include tenant context
4. **Test local routing**

### Phase 3: Domain Management (Week 3)
1. **Build domain verification system**
2. **Implement Vercel domain API integration**
3. **Add subdomain support**
4. **Test custom domain routing**

### Phase 4: User Experience (Week 4)
1. **Create tenant management interface**
2. **Implement tenant switching**
3. **Add tenant-specific theming**
4. **Migration tools for existing users**

## Database Migration Strategy

### Local Development Setup
1. **Create platform database**: Change `themes-dev` to `platform` database
2. **Update environment templates**: Create `.env.platform.template`
3. **Database scripts**: Update scripts to use platform database
4. **Schema versioning**: Maintain separate schema versions

### Data Migration Plan
```sql
-- Step 1: Create default tenant for existing data
INSERT INTO tenants (id, name, slug, subdomain) 
VALUES ('default', 'Default Tenant', 'default', 'www');

-- Step 2: Migrate existing blogs to default tenant
UPDATE blogs SET tenantId = 'default';

-- Step 3: Create tenant-user relationships
INSERT INTO tenant_users (userId, tenantId, role)
SELECT id, 'default', 'OWNER' FROM users;
```

### Rollback Strategy
- **Database**: Keep separate platform database, can switch back to main
- **Code**: Use git branches (main vs platform)
- **DNS**: Preserve existing routing during transition
- **Data**: Export/import utilities for data migration

## Local Development Approach

### Environment Management
```bash
# .env.platform.template
PRISMA_DATABASE_URL="postgresql://postgres:password@localhost:5432/fromcafe_platform"
DATABASE_URL="postgresql://postgres:password@localhost:5432/fromcafe_platform"
BRANCH="platform"
```

### Local Testing Setup
1. **Hosts file configuration**: Add local subdomains to `/etc/hosts`
   ```
   127.0.0.1 tenant1.localhost
   127.0.0.1 tenant2.localhost
   ```

2. **Development server**: Configure Next.js to handle custom hostnames
   ```typescript
   // next.config.ts
   const nextConfig = {
     experimental: {
       serverComponentsExternalPackages: ['prisma']
     },
     async rewrites() {
       return [
         {
           source: '/:path*',
           destination: '/tenant/:tenantSlug/:path*',
           has: [
             {
               type: 'host',
               value: '(?<tenantSlug>.*)\\.localhost'
             }
           ]
         }
       ]
     }
   }
   ```

3. **Database seeding**: Create test tenants and data
   ```typescript
   // prisma/seed.ts
   const tenants = [
     { name: 'Test Tenant 1', slug: 'tenant1', subdomain: 'tenant1' },
     { name: 'Test Tenant 2', slug: 'tenant2', subdomain: 'tenant2' }
   ]
   ```

### Local Testing Workflow
1. **Start development server**: `npm run dev`
2. **Access tenant sites**: `http://tenant1.localhost:3000`
3. **Test custom domains**: Add to hosts file and test routing
4. **Debug middleware**: Use console logs for tenant detection
5. **Database inspection**: Use Prisma Studio to verify tenant isolation

## Risk Mitigation

### Technical Risks
- **Edge Runtime Conflicts**: Use separate API routes for Prisma operations
- **DNS Propagation**: Implement retry logic for domain verification
- **SSL Certificate Delays**: Queue certificate generation requests
- **Database Performance**: Add proper indexing for tenant-scoped queries

### Migration Risks
- **Data Loss**: Comprehensive backup before migration
- **Downtime**: Blue-green deployment strategy
- **User Impact**: Gradual rollout with fallback options
- **SEO Impact**: Proper redirects from old to new URLs

### Rollback Plan
1. **Immediate**: Switch git branch and restart deployment
2. **Database**: Restore from backup and update DNS
3. **DNS**: Revert nameserver changes if needed
4. **User Communication**: Automated notifications of any issues

## Success Metrics

### Technical Metrics
- **Tenant Isolation**: 100% data isolation between tenants
- **Performance**: <100ms additional latency for tenant resolution
- **Availability**: 99.9% uptime during migration
- **Security**: All tenant data properly isolated

### User Metrics
- **Migration Success**: 100% of existing users migrated without data loss
- **Custom Domain Setup**: <5 minutes average setup time
- **Subdomain Creation**: Instant subdomain activation
- **User Satisfaction**: >90% positive feedback on new features

## Timeline

- **Week 1**: Database schema and migration scripts
- **Week 2**: Routing infrastructure and middleware
- **Week 3**: Domain management and Vercel integration
- **Week 4**: User interface and testing
- **Week 5**: Production deployment and monitoring

## Next Steps

1. **Create platform database** locally
2. **Implement tenant model** in Prisma schema
3. **Test tenant-aware middleware** with local subdomains
4. **Build domain verification system**
5. **Deploy to Vercel** for production testing

This plan provides a comprehensive roadmap for implementing multi-tenant architecture while maintaining backward compatibility and minimizing risks during the transition.