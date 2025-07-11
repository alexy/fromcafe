import { NextRequest, NextResponse } from 'next/server'
import { validateGhostAuth } from '@/lib/ghost-auth'

/**
 * GET /ghost/api/v4/admin/members - Get members list (Ghost Admin API compatible)
 * Used by publishing tools to check member/subscriber functionality
 */
export async function GET(request: NextRequest) {
  console.log('👻 GET /api/ghost/admin/members handler called')
  console.log('👻 Members request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')
    const limit = parseInt(searchParams.get('limit') || '15')
    
    console.log('👻 Members query params:', { domain, subdomain, blogSlug, limit })

    // Validate authentication and find blog
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('👻 Members authentication failed')
      return authResult.error
    }
    
    const { blog } = authResult
    console.log('👻 Members authentication successful, blog ID:', blog.id)

    // Return empty members list for now (most blogs don't have members)
    return NextResponse.json({
      members: [],
      meta: {
        pagination: {
          page: 1,
          limit: limit,
          pages: 1,
          total: 0,
          next: null,
          prev: null
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ghost-Version': '5.120.3',
        'Content-Version': 'v5.120'
      }
    })

  } catch (error) {
    console.error('👻 Error getting Ghost members:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/ghost/admin/members - Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  console.log('👻 OPTIONS /api/ghost/admin/members handler called')
  console.log('👻 Members OPTIONS request headers:', Object.fromEntries(request.headers.entries()))
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Version',
      'Content-Type': 'application/json',
      'X-Ghost-Version': '5.120.3'
    }
  })
}