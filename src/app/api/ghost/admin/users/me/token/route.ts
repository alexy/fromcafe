import { NextRequest, NextResponse } from 'next/server'
import { validateGhostAuth } from '@/lib/ghost-auth'

/**
 * GET /ghost/api/admin/users/me/token - Validate user token (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest) {
  console.log('👻 GET /api/ghost/admin/users/me/token handler called')
  console.log('👻 Token validation request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')
    
    console.log('👻 Token validation query params:', { domain, subdomain, blogSlug })

    // Validate authentication and find blog
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('👻 Token validation authentication failed')
      return authResult.error
    }
    
    const { tokenData } = authResult
    console.log('👻 Token validation successful, user ID:', tokenData.userId)

    // Return token validation response
    return NextResponse.json({
      // This endpoint just confirms the token is valid
      valid: true,
      user_id: tokenData.userId,
      blog_id: tokenData.blogId
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ghost-Version': '5.120.3'
      }
    })

  } catch (error) {
    console.error('👻 Error validating Ghost token:', error)
    return NextResponse.json(
      { errors: [{ message: 'Token validation failed' }] },
      { status: 401 }
    )
  }
}