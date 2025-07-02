# OAuth Authentication Architecture: FromCafe Evernote Integration

## Executive Summary

This document describes the complex OAuth authentication architecture implemented in FromCafe, a blog platform that integrates with Evernote. The system successfully manages dual OAuth flows (Google for user authentication, Evernote for notebook access) while handling edge cases like JWT session corruption, environment variable rotation, and OAuth redirect loops.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The OAuth Challenge](#the-oauth-challenge)
3. [Critical Problems Solved](#critical-problems-solved)
4. [Technical Implementation](#technical-implementation)
5. [Session Management](#session-management)
6. [Error Recovery Mechanisms](#error-recovery-mechanisms)
7. [Deployment Considerations](#deployment-considerations)
8. [Security Best Practices](#security-best-practices)

## Architecture Overview

FromCafe implements a **dual OAuth architecture** where users authenticate via Google OAuth for platform access, and subsequently authorize Evernote access for notebook synchronization.

```
User Journey:
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Google    │───▶│   FromCafe   │───▶│    Evernote     │
│   OAuth     │    │   Platform   │    │   OAuth         │
│ (Identity)  │    │ (Authenticated)│    │ (Notebook Access)│
└─────────────┘    └──────────────┘    └─────────────────┘
```

### Key Components

1. **NextAuth.js**: Handles Google OAuth and JWT session management
2. **Evernote SDK**: Manages Evernote OAuth flow and API access
3. **Prisma Database**: Stores user credentials and Evernote tokens
4. **Custom Session Management**: Handles edge cases and recovery

## The OAuth Challenge

### Multi-Provider Complexity

The primary challenge was managing two independent OAuth providers with different token lifecycles:

- **Google OAuth (NextAuth.js)**: Short-lived sessions, automatic refresh
- **Evernote OAuth**: Long-lived tokens, manual refresh, different scopes

### Environmental Challenges

1. **Vercel Deployment URLs**: Dynamic preview URLs vs. production URLs
2. **Environment Variable Rotation**: NEXTAUTH_SECRET changes invalidating sessions
3. **Callback URL Management**: Different domains for different environments

## Critical Problems Solved

### 1. JWT Session Corruption (The NEXTAUTH_SECRET Problem)

**Problem**: When `NEXTAUTH_SECRET` was rotated in Vercel, all existing sessions became invalid, causing widespread JWT decryption errors.

**Solution**: Implemented automatic session recovery with cookie cleanup:

```typescript
// /api/auth/clear-invalid-session/route.ts
export async function POST() {
  const response = NextResponse.json({ clearedInvalidCookies: true })
  
  // Clear all NextAuth cookie variants
  const cookiesToClear = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token', 
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token'
  ]
  
  cookiesToClear.forEach(name => {
    response.cookies.delete(name)
  })
  
  return response
}
```

### 2. JWT Key Derivation Issues

**Problem**: Manual session creation was using incorrect key derivation, causing JWT encryption/decryption failures.

**Original (Broken) Implementation**:
```typescript
// WRONG: Simple byte slicing
const key = secret.slice(0, 32)
```

**Fixed Implementation**:
```typescript
// CORRECT: HKDF-SHA256 key derivation (matches NextAuth.js)
const key = await crypto.subtle.deriveKey(
  {
    name: 'HKDF',
    hash: 'SHA-256',
    salt: new Uint8Array(),
    info: new TextEncoder().encode('NextAuth.js Generated Encryption Key')
  },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
)
```

### 3. Vercel URL Detection and Redirect Loops

**Problem**: Complex URL override logic was fighting with Vercel's automatic URL detection, causing infinite redirect loops.

**Solution**: Simplified URL handling to trust Vercel's environment:

```typescript
// lib/auth.ts - Simplified NextAuth configuration
export const authOptions: AuthOptions = {
  // Remove complex URL overrides, let NextAuth detect automatically
  providers: [GoogleProvider({...})],
  callbacks: {
    // Simplified JWT and session callbacks
  }
}
```

### 4. Evernote OAuth Integration

**Problem**: Integrating Evernote's OAuth 1.0a flow with NextAuth's OAuth 2.0 architecture.

**Solution**: Implemented separate Evernote OAuth flow with proper callback handling:

```typescript
// Evernote OAuth flow
export function getEvernoteAuthUrl(userToken?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const baseUrl = getBaseUrl() // Smart URL detection
    const callbackUrl = `${baseUrl}/api/evernote/oauth-callback${
      userToken ? `?token=${encodeURIComponent(userToken)}` : ''
    }`
    
    client.getRequestToken(callbackUrl, (error, oauthToken, oauthTokenSecret) => {
      if (error) {
        reject(new Error(`Failed to connect to Evernote: ${error.message}`))
        return
      }
      
      storeTokenSecret(oauthToken, oauthTokenSecret).then(() => {
        const authUrl = client.getAuthorizeUrl(oauthToken)
        resolve(authUrl)
      })
    })
  })
}
```

## Technical Implementation

### Session Architecture

The system maintains two types of sessions:

1. **NextAuth Session** (Google OAuth)
   - Handles user identity and platform authentication
   - JWT-based with automatic refresh
   - Stored in HTTP-only cookies

2. **Evernote Session** (Evernote OAuth)
   - Handles notebook access and API calls
   - Long-lived tokens stored in database
   - Manual refresh and validation

### Database Schema

```sql
-- User table with dual OAuth support
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String?
  image                 String?
  
  -- Google OAuth (NextAuth)
  accounts              Account[]
  sessions              Session[]
  
  -- Evernote OAuth
  evernoteToken         String?  @db.Text
  evernoteTokenSecret   String?  @db.Text
  evernoteNoteStoreUrl  String?
  evernoteUserId        String?
  
  blogs                 Blog[]
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### Environment Variable Management

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://fromcafe.vercel.app
NEXTAUTH_SECRET=<rotatable-secret>

# Google OAuth
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>

# Evernote OAuth
EVERNOTE_CONSUMER_KEY=<evernote-consumer-key>
EVERNOTE_CONSUMER_SECRET=<evernote-consumer-secret>

# Vercel automatically provides:
VERCEL_URL=<deployment-specific-url>
VERCEL_ENV=production|preview|development
```

## Session Management

### Bypass Mode for Post-OAuth Recovery

When Evernote OAuth redirects back, NextAuth sessions might be in an inconsistent state. We implemented a bypass mode:

```typescript
// Dashboard component - handling post-OAuth state
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const evernoteBypass = urlParams.get('evernote_bypass') === 'true'
  
  if (evernoteBypass) {
    // Skip NextAuth validation, restore minimal session
    const restoreSession = async () => {
      const response = await fetch('/api/auth/create-session', { method: 'POST' })
      if (response.ok) {
        // Continue with dashboard loading
        fetchBlogs()
        checkEvernoteConnection()
      }
    }
    restoreSession()
  }
}, [])
```

### Smart URL Detection

The system intelligently detects the correct base URL across different environments:

```typescript
function getBaseUrl(): string {
  // Vercel deployment - use actual deployment URL
  if (process.env.VERCEL && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Explicit override
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  
  // Local development
  return 'http://localhost:3000'
}
```

## Error Recovery Mechanisms

### Automatic Cookie Cleanup

When JWT decryption fails, the system automatically clears invalid cookies:

```typescript
// Dashboard error handling
if (response.status === 401) {
  console.log('Authentication error, attempting to clear invalid cookies')
  try {
    const clearResponse = await fetch('/api/auth/clear-invalid-session', { 
      method: 'POST' 
    })
    const clearResult = await clearResponse.json()
    
    if (clearResult.clearedInvalidCookies) {
      setShowError('Session expired. Please refresh the page and sign in again.')
    }
  } catch (clearError) {
    console.error('Error clearing invalid cookies:', clearError)
  }
}
```

### Session Restoration

For edge cases where NextAuth fails, manual session restoration:

```typescript
// /api/auth/create-session/route.ts
export async function POST() {
  try {
    const user = await getCurrentUser() // Custom user detection
    
    if (user) {
      const token = await createJWT(user) // Proper JWT creation
      const response = NextResponse.json({ success: true })
      
      // Set session cookie with correct attributes
      response.cookies.set('next-auth.session-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      })
      
      return response
    }
  } catch (error) {
    console.error('Session creation failed:', error)
  }
  
  return NextResponse.json({ success: false }, { status: 401 })
}
```

## Deployment Considerations

### Vercel-Specific Optimizations

1. **Dynamic URL Handling**: Automatically adapts to preview vs. production URLs
2. **Environment Variable Rotation**: Graceful handling of secret rotation
3. **Edge Function Compatibility**: Optimized for Vercel's serverless environment

### Security Headers

```typescript
// Middleware for OAuth security
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // OAuth-specific security headers
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  }
  
  return response
}
```

## Security Best Practices

### Token Storage

1. **NextAuth Tokens**: HTTP-only cookies with proper security attributes
2. **Evernote Tokens**: Encrypted storage in database, never exposed to client
3. **Secret Rotation**: Automatic handling of rotated secrets

### OAuth Security

1. **CSRF Protection**: Built-in NextAuth CSRF tokens
2. **State Validation**: Proper OAuth state parameter validation
3. **Secure Redirects**: Whitelist of allowed redirect URLs

### Error Handling

1. **No Token Leakage**: Error messages never expose sensitive tokens
2. **Graceful Degradation**: Fallback mechanisms for authentication failures
3. **Audit Logging**: Comprehensive logging for security incidents

## Conclusion

The FromCafe OAuth architecture successfully handles the complexity of dual OAuth providers while maintaining security and user experience. Key innovations include:

- **Intelligent session recovery** from JWT corruption
- **Bypass mechanisms** for post-OAuth state management  
- **Environment-aware URL detection** for Vercel deployments
- **Graceful error handling** with automatic cleanup

This architecture can serve as a reference for other applications requiring multiple OAuth integrations in serverless environments.

## Future Improvements

1. **Token Refresh Automation**: Automatic Evernote token refresh
2. **Rate Limiting**: Built-in rate limiting for OAuth endpoints
3. **Multi-Tenant Support**: Support for multiple Evernote accounts per user
4. **Audit Trail**: Enhanced logging and monitoring for OAuth flows

---

*Document Version: 1.0*  
*Last Updated: July 2, 2025*  
*Author: Claude (AI Assistant) with Human Oversight*