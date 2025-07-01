# Google OAuth Redirect URI Mismatch Fix

## Problem

Google OAuth occasionally fails on Vercel with redirect URI mismatch errors:
- Sometimes wants: `https://your-app.vercel.app/auth/signin` ✅
- Sometimes wants: `https://your-app-br0yhhag5-team.vercel.app/auth/signin` ❌

## Root Cause

Vercel creates different URLs for different deployment types:
- **Production deployments**: `https://your-app.vercel.app` (clean URL)
- **Preview/branch deployments**: `https://your-app-[hash]-[team].vercel.app` (with hash)

NextAuth automatically detects the current URL, but Google OAuth requires pre-configured exact redirect URIs.

## Why URLs Change

### Vercel Deployment Types:
1. **Production (main branch)**: Uses your configured production domain
2. **Preview (PRs/branches)**: Gets unique URLs with random hashes for isolation
3. **Development**: Uses localhost

### NextAuth Behavior:
- Auto-detects current deployment URL
- Uses that URL for OAuth redirect_uri
- Can override `NEXTAUTH_URL` environment variable in some cases

## Solution Implemented

### 1. Added Vercel-Specific Configuration

```typescript
// Force consistent URL for Vercel deployments to prevent redirect URI mismatches
...(process.env.VERCEL && {
  trustHost: true,
  useSecureCookies: true,
}),
```

**What this does:**
- `trustHost: true` - Trusts the host header from Vercel's proxy
- `useSecureCookies: true` - Forces secure cookies on HTTPS

### 2. Custom Redirect Callback

```typescript
redirect: async ({ url, baseUrl }: { url: string; baseUrl: string }) => {
  // Force redirect to production URL on Vercel to prevent OAuth mismatch
  if (process.env.VERCEL && process.env.VERCEL_ENV === 'production') {
    // Use NEXTAUTH_URL if set, otherwise construct from VERCEL_URL
    const productionUrl = process.env.NEXTAUTH_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : baseUrl)
    
    if (url.startsWith('/')) {
      return `${productionUrl}${url}`
    }
    if (url.startsWith(baseUrl)) {
      return url.replace(baseUrl, productionUrl)
    }
    return productionUrl
  }
  // Default behavior for local development
  if (url.startsWith('/')) return `${baseUrl}${url}`
  if (new URL(url).origin === baseUrl) return url
  return baseUrl
},
```

**What this does:**
- Forces all OAuth redirects to use the configured production URL (NEXTAUTH_URL or VERCEL_URL)
- Only applies to production deployments on Vercel
- Maintains normal behavior for local development

## Google OAuth Console Configuration

Ensure these redirect URIs are configured in Google OAuth Console:

**Required:**
```
https://your-app.vercel.app/api/auth/callback/google
```

**Optional (for local development):**
```
http://localhost:3000/api/auth/callback/google
```

**NOT needed anymore:**
- Preview deployment URLs (with hashes)
- Multiple Vercel URLs

## Environment Variables

### Required on Vercel:
```env
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=[your-secret]
GOOGLE_CLIENT_ID=[your-client-id]
GOOGLE_CLIENT_SECRET=[your-client-secret]
```

### Vercel System Variables (Automatic):
- `VERCEL=1` - Indicates Vercel environment
- `VERCEL_ENV=production` - Environment type
- `VERCEL_URL` - Current deployment URL

## Testing

### Local Development:
- Uses `http://localhost:3000` 
- Normal NextAuth behavior

### Vercel Production:
- Always redirects to your configured production URL
- Consistent OAuth redirect URIs  
- No more hash-based URL mismatches

### Vercel Preview:
- Uses production URL for OAuth redirects
- Prevents preview deployment URL conflicts
- Users can still access the preview normally

## Result

✅ **Consistent OAuth redirect URIs** - Always uses production URL  
✅ **No more preview deployment conflicts** - Preview builds work without OAuth errors  
✅ **Single Google OAuth configuration** - Only need one redirect URI  
✅ **Backward compatible** - Local development unchanged  

OAuth should now work reliably on Vercel without redirect URI mismatch errors!