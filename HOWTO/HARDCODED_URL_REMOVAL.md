# Hardcoded URL Removal - Dynamic Environment-Based URLs

## Problem

The application contained hardcoded URLs that made it non-portable:
- `https://fromcafe.vercel.app` was hardcoded in OAuth redirect logic
- Documentation contained deployment-specific examples
- Could not be reused for different deployments or domains

## Solution

### 1. Dynamic URL Construction in OAuth

**Before (Hardcoded):**
```typescript
const productionUrl = 'https://fromcafe.vercel.app'
```

**After (Dynamic):**
```typescript
// Use NEXTAUTH_URL if set, otherwise construct from VERCEL_URL
const productionUrl = process.env.NEXTAUTH_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : baseUrl)
```

### 2. Environment Variable Priority

1. **NEXTAUTH_URL** - Explicit production URL (if configured)
2. **VERCEL_URL** - Automatic Vercel deployment URL  
3. **baseUrl** - Fallback to detected base URL

### 3. Documentation Updates

**Before:**
- Used `fromcafe.vercel.app` in examples
- Deployment-specific configuration

**After:**
- Uses generic `your-app.vercel.app` examples
- Portable configuration instructions

## Environment Variable Usage

### Production Deployment:
```env
# Option 1: Explicit URL (recommended)
NEXTAUTH_URL=https://your-domain.com

# Option 2: Let Vercel auto-detect
# (VERCEL_URL is automatically provided)
```

### Local Development:
```env
NEXTAUTH_URL=http://localhost:3000
```

## Benefits

✅ **Portable** - Works with any domain or deployment  
✅ **Flexible** - Supports custom domains and Vercel subdomains  
✅ **Environment-aware** - Automatically adapts to deployment context  
✅ **Maintainable** - No hardcoded values to update  

## Files Changed

### Source Code:
- `src/lib/auth.ts` - OAuth redirect callback logic

### Documentation:
- `OAUTH_REDIRECT_URI_FIX.md` - Updated examples and configuration

## Deployment Compatibility

### Vercel Subdomain:
- Uses `your-app.vercel.app` automatically
- No manual configuration needed

### Custom Domain:
- Set `NEXTAUTH_URL=https://your-domain.com`
- Works with any domain

### Multiple Deployments:
- Each deployment uses its own URL
- No conflicts between environments

The application is now fully portable and can be deployed to any domain without hardcoded URL dependencies!