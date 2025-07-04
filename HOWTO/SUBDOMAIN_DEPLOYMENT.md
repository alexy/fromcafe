# Subdomain Deployment Guide

## Overview

This guide explains how to deploy subdomain support for fromcafe, enabling URLs like:
- `tales.from.cafe` (user's subdomain)
- `tales.from.cafe/my-blog` (specific blog)
- `tales.from.cafe/my-blog/my-post` (specific post)

## Code Implementation

### 1. Middleware Configuration ✅

The middleware (`src/middleware.ts`) now handles:
- **Subdomain detection**: Extracts subdomain from hostname
- **URL rewriting**: Maps subdomain requests to user paths
- **Domain routing**: Supports both `*.from.cafe` and Vercel preview URLs

### 2. Next.js Configuration ✅

Updated `next.config.ts` to support subdomain routing with experimental middleware features.

## Vercel Deployment Steps

### Step 1: Add Wildcard Domain to Vercel Project

1. **Go to Vercel Dashboard** → Your Project → Settings → Domains
2. **Add Domain**: `*.from.cafe`
3. **Configure DNS** (see Step 2)

### Step 2: DNS Configuration

You need to configure DNS for `from.cafe` domain:

#### Option A: Point Domain to Vercel (Recommended)
```
# Add these DNS records at your domain registrar:
Type: CNAME
Name: *
Value: cname.vercel-dns.com

Type: A  
Name: @
Value: 76.76.19.19

Type: A
Name: www
Value: 76.76.19.19
```

#### Option B: Use Vercel Nameservers
1. Change nameservers to Vercel's nameservers
2. Vercel will handle all DNS automatically

### Step 3: Environment Variables

Ensure these are set in Vercel:

```bash
# Required
NEXTAUTH_URL=https://from.cafe
DATABASE_URL=your_postgres_url
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
EVERNOTE_CONSUMER_KEY=your_evernote_key
EVERNOTE_CONSUMER_SECRET=your_evernote_secret

# Optional
NEXTAUTH_SECRET=your_secret_key
```

**Important**: `NEXTAUTH_URL` should be your main domain (`https://from.cafe`), not a subdomain.

### Step 4: Deploy and Test

1. **Deploy** the updated code to Vercel
2. **Wait for DNS propagation** (can take up to 48 hours)
3. **Test URLs**:
   - `https://from.cafe` → Main site
   - `https://tales.from.cafe` → User's blog list
   - `https://tales.from.cafe/my-blog` → Specific blog

## Testing Subdomain Routing

### Local Testing (Optional)

To test subdomains locally:

1. **Edit `/etc/hosts`** (macOS/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
   ```
   127.0.0.1 tales.localhost
   127.0.0.1 john.localhost
   ```

2. **Start development server**: `npm run dev`

3. **Test URLs**:
   - `http://tales.localhost:3000` → Should show tales' blogs
   - `http://john.localhost:3000` → Should show john's blogs

### Production Testing

Once deployed and DNS is configured:

1. **Main domain**: `https://from.cafe`
   - Should show main site
   - Dashboard, admin, auth should work normally

2. **User subdomains**: `https://tales.from.cafe`
   - Should show tales' blog list page
   - Should rewrite to `/tales` internally

3. **Blog URLs**: `https://tales.from.cafe/my-blog`
   - Should show specific blog
   - Should rewrite to `/tales/my-blog` internally

## How Subdomain Routing Works

### URL Mapping
```
tales.from.cafe/              → /tales (user's blog list)
tales.from.cafe/free-write    → /tales/free-write (specific blog)
tales.from.cafe/free-write/my-post → /tales/free-write/my-post (specific post)
```

### Middleware Logic
1. **Extract subdomain** from hostname (`tales` from `tales.from.cafe`)
2. **Skip middleware** for main domain paths (`/admin`, `/dashboard`, etc.)
3. **Rewrite URLs** to map subdomain to user paths
4. **Preserve original URL** in browser address bar

### Fallback Behavior
- **Invalid subdomains**: Fall through to 404
- **Main domain**: Normal routing (no subdomain)
- **API routes**: Always bypass subdomain routing

## Troubleshooting

### Common Issues

1. **"This site can't be reached"**
   - DNS not configured or still propagating
   - Check domain registrar DNS settings

2. **Redirects to Vercel domain**
   - Ensure `NEXTAUTH_URL=https://from.cafe`
   - Check that custom domain is properly configured

3. **404 errors on subdomains**
   - Verify user exists with that slug in database
   - Check middleware logs in Vercel functions

4. **CSS/JS not loading on subdomains**
   - Ensure `/_next/` paths are excluded in middleware
   - Check that static assets are served correctly

### Debug Tools

1. **Vercel Function Logs**: Check middleware execution
2. **Browser DevTools**: Network tab for failed requests
3. **DNS Checker**: Verify DNS propagation
4. **Console Logs**: Middleware includes debug logging

## Security Considerations

1. **CORS**: Subdomains share cookies with main domain
2. **Authentication**: NextAuth works across subdomains
3. **SSL**: Vercel provides automatic SSL for wildcard domains
4. **Data Isolation**: Each subdomain shows only that user's content

## Rollback Plan

If subdomain deployment fails:

1. **Remove wildcard domain** from Vercel
2. **Revert middleware** to previous version
3. **Users can still access** via path-based URLs (`from.cafe/tales/my-blog`)
4. **No data loss** - only routing method changes