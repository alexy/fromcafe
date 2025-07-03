# Vercel Callback URL Configuration Fix

## Problem

Evernote OAuth was failing on Vercel with error:
```
Page not found
The location you provided is not valid. (/undefined/api/evernote/callback)
```

**Root Cause:** The callback URL was being constructed as `${process.env.APP_URL}/api/evernote/callback`, but `APP_URL` was not set on Vercel, resulting in `/undefined/api/evernote/callback`.

## Solution

### Updated URL Construction Logic

**Before:**
```typescript
// Hard-coded to use APP_URL (not available on Vercel)
const callbackUrl = `${process.env.APP_URL}/api/evernote/callback`
const webhookUrl = `${process.env.APP_URL}/api/evernote/webhook`
```

**After:**
```typescript
// Smart detection of deployment environment
const baseUrl = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.APP_URL || 'http://localhost:3000'

const callbackUrl = `${baseUrl}/api/evernote/callback`
const webhookUrl = `${baseUrl}/api/evernote/webhook`
```

### Environment Variable Priority

1. **Vercel Production**: Uses `VERCEL_URL` (automatically provided)
   - Format: `https://your-app-domain.vercel.app`
   - No manual configuration needed

2. **Local Development**: Uses `APP_URL` from `.env` file
   - Format: `http://localhost:3000`
   - Manually configured for local development

3. **Fallback**: Defaults to `http://localhost:3000`
   - Used if neither `VERCEL_URL` nor `APP_URL` is available

## Vercel Environment Variables

### Automatically Provided by Vercel:
- `VERCEL_URL` - The deployment URL (e.g., `your-app-abc123.vercel.app`)
- `VERCEL_ENV` - Environment type (`production`, `preview`, `development`)
- `VERCEL_GIT_COMMIT_SHA` - Git commit hash

### Manually Configured (if needed):
- `APP_URL` - Custom domain override (optional)

## Testing

### Local Development:
```bash
# Will use APP_URL=http://localhost:3000
npm run dev
```

### Vercel Deployment:
```bash
# Will automatically use VERCEL_URL=https://your-app.vercel.app
# No manual configuration needed
```

## Fixed URLs

### Callback URL Examples:
- **Local**: `http://localhost:3000/api/evernote/callback`
- **Vercel**: `https://your-app-abc123.vercel.app/api/evernote/callback`

### Webhook URL Examples:
- **Local**: `http://localhost:3000/api/evernote/webhook`
- **Vercel**: `https://your-app-abc123.vercel.app/api/evernote/webhook`

## Result

✅ **Evernote OAuth flow works on Vercel**  
✅ **Callback URLs are correctly constructed**  
✅ **Webhook registration works with proper URLs**  
✅ **Local development remains unchanged**  

The Evernote integration should now work properly on both local development and Vercel deployments without requiring manual URL configuration.