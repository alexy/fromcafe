# Forcing NextAuth to Respect NEXTAUTH_URL on Vercel

## Problem

NextAuth on Vercel often ignores the `NEXTAUTH_URL` environment variable and auto-detects URLs, leading to:
- Random redirect URIs (preview deployment URLs)
- OAuth failures due to redirect URI mismatches
- Inconsistent behavior between deployments

## Root Cause

NextAuth has built-in URL auto-detection that can override environment variables:
1. Uses `x-forwarded-host` header from Vercel's proxy
2. Falls back to `host` header detection
3. May ignore `NEXTAUTH_URL` in certain Vercel configurations

## Solution Implemented

### 1. Programmatic NEXTAUTH_URL Setting

**Before NextAuth initialization:**
```typescript
// Ensure NEXTAUTH_URL is set for NextAuth's internal URL detection
if (process.env.VERCEL && !process.env.NEXTAUTH_URL) {
  const computedUrl = getBaseUrl()
  console.log('Setting NEXTAUTH_URL to computed value:', computedUrl)
  process.env.NEXTAUTH_URL = computedUrl
}
```

**URL Priority Logic:**
1. Use existing `NEXTAUTH_URL` if set
2. Construct from `VERCEL_URL` for production
3. Fallback to `localhost:3000` for development

### 2. Explicit Base URL Function

```typescript
const getBaseUrl = () => {
  // Explicitly use NEXTAUTH_URL if set
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  
  // For Vercel production, construct from domain
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Local development fallback
  return 'http://localhost:3000'
}
```

### 3. Override Redirect Callback

```typescript
redirect: async ({ url, baseUrl }: { url: string; baseUrl: string }) => {
  // Always use our explicit base URL to prevent random redirects
  const forcedBaseUrl = getBaseUrl()
  
  console.log('NextAuth redirect:', { 
    url, 
    originalBaseUrl: baseUrl, 
    forcedBaseUrl,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_ENV: process.env.VERCEL_ENV 
  })
  
  // Force all redirects to use our computed URL
  if (url.startsWith('/')) {
    return `${forcedBaseUrl}${url}`
  }
  
  if (url.startsWith(baseUrl)) {
    return url.replace(baseUrl, forcedBaseUrl)
  }
  
  return forcedBaseUrl
}
```

## Environment Variable Setup

### Vercel Dashboard:
```env
# Option 1: Explicit URL (recommended)
NEXTAUTH_URL=https://your-app.vercel.app

# Option 2: Let the code compute from VERCEL_URL
# (Will automatically use https://your-app.vercel.app)
```

### Local Development:
```env
NEXTAUTH_URL=http://localhost:3000
```

## Debugging

The implementation includes extensive logging to help debug URL issues:

```
NextAuth redirect: {
  url: '/dashboard',
  originalBaseUrl: 'https://your-app-abc123.vercel.app',
  forcedBaseUrl: 'https://your-app.vercel.app',
  NEXTAUTH_URL: 'https://your-app.vercel.app',
  VERCEL_URL: 'your-app.vercel.app',
  VERCEL_ENV: 'production'
}
```

## How It Works

### Deployment Flow:
1. **Code loads** → `getBaseUrl()` computes correct URL
2. **If no NEXTAUTH_URL** → Set `process.env.NEXTAUTH_URL` programmatically  
3. **NextAuth initializes** → Uses our forced URL instead of auto-detecting
4. **OAuth redirects** → Callback ensures consistent URL usage

### URL Resolution Priority:
1. **Manual NEXTAUTH_URL** (if set in environment)
2. **Computed from VERCEL_URL** (for production deployments)
3. **Localhost fallback** (for development)

## Result

✅ **Consistent OAuth redirects** - Always uses the same base URL  
✅ **Respects NEXTAUTH_URL** - Environment variable takes precedence  
✅ **Debug visibility** - Logs show exactly what URLs are being used  
✅ **Automatic fallback** - Computes URL if NEXTAUTH_URL not set  

This should eliminate random redirect URI errors and ensure OAuth works reliably on Vercel!