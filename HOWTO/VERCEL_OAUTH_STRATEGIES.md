# Vercel OAuth Strategies: Production vs Preview Deployments

## The Issue You Encountered

From your logs:
```
NextAuth redirect: {
  url: '/dashboard',
  originalBaseUrl: 'https://fromcafe-3s6s2df4y-fromcafe.vercel.app',
  forcedBaseUrl: 'https://fromcafe.vercel.app',
  NEXTAUTH_URL: 'https://fromcafe.vercel.app',
  VERCEL_URL: 'fromcafe-3s6s2df4y-fromcafe.vercel.app',
  VERCEL_ENV: 'production'
}
```

**The problem:** You have `NEXTAUTH_URL` set to production URL, but you're testing on a preview deployment with a different URL.

## Two OAuth Strategies

### Strategy 1: Production-Only OAuth ✅ (Recommended)

**Setup:**
- Keep `NEXTAUTH_URL=https://fromcafe.vercel.app` in Vercel environment
- Configure only production URL in Google OAuth Console
- OAuth only works on main production deployment

**Google OAuth Console:**
```
https://fromcafe.vercel.app/api/auth/callback/google
```

**Pros:**
- ✅ Simple Google OAuth setup (one URL)
- ✅ Consistent OAuth behavior
- ✅ No preview deployment security concerns

**Cons:**
- ❌ Can't test OAuth on preview deployments
- ❌ Must merge to main to test OAuth features

### Strategy 2: Preview-Friendly OAuth 🔄

**Setup:**
- Remove `NEXTAUTH_URL` from Vercel environment variables
- Let each deployment use its actual URL
- Configure multiple URLs in Google OAuth Console

**Google OAuth Console:**
```
https://fromcafe.vercel.app/api/auth/callback/google
https://fromcafe-*.vercel.app/api/auth/callback/google
```

**Pros:**
- ✅ OAuth works on all deployments
- ✅ Can test OAuth features in preview branches
- ✅ Flexible development workflow

**Cons:**
- ❌ Google OAuth Console requires wildcard or many URLs
- ❌ Preview deployments have OAuth access to production data
- ❌ More complex security model

## Current Implementation

The code now supports both strategies:

```typescript
const getBaseUrl = () => {
  // If NEXTAUTH_URL is explicitly set, use it (Strategy 1)
  if (process.env.NEXTAUTH_URL) {
    console.log('Using explicit NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
    return process.env.NEXTAUTH_URL
  }
  
  // For Vercel deployments, use actual VERCEL_URL (Strategy 2)
  if (process.env.VERCEL && process.env.VERCEL_URL) {
    const vercelUrl = `https://${process.env.VERCEL_URL}`
    console.log('Using VERCEL_URL:', vercelUrl)
    return vercelUrl
  }
  
  return 'http://localhost:3000'
}
```

## Recommended Action

### For Production-Only OAuth (Strategy 1):
1. **Keep** `NEXTAUTH_URL=https://fromcafe.vercel.app` in Vercel
2. **Ensure** only production URL in Google OAuth Console
3. **Test OAuth** only on main branch deployments

### For Preview-Friendly OAuth (Strategy 2):
1. **Remove** `NEXTAUTH_URL` from Vercel environment variables
2. **Add wildcard** `https://fromcafe-*.vercel.app/api/auth/callback/google` to Google OAuth Console
3. **Test OAuth** on any branch/preview deployment

## Google OAuth Console Wildcard Support

Google OAuth Console supports wildcards for subdomains:
```
✅ https://fromcafe-*.vercel.app/api/auth/callback/google
✅ https://*.fromcafe.vercel.app/api/auth/callback/google
❌ https://fromcafe-*-team.vercel.app/api/auth/callback/google (complex patterns not supported)
```

## Security Considerations

### Production-Only OAuth:
- 🔒 Preview deployments can't access OAuth
- 🔒 Only main branch has user authentication
- 🔒 Prevents accidental data access from feature branches

### Preview-Friendly OAuth:
- ⚠️ Any preview deployment can authenticate users
- ⚠️ Feature branches have access to production user data
- ⚠️ Requires careful branch protection and review

## My Recommendation

Use **Strategy 1 (Production-Only OAuth)** because:
- ✅ Simpler and more secure
- ✅ Prevents preview deployments from accessing user data
- ✅ OAuth testing happens in a controlled environment
- ✅ One redirect URI to manage

The current code supports both approaches - just choose your strategy and configure accordingly!