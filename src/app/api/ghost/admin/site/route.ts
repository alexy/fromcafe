import { NextRequest, NextResponse } from 'next/server'
import { validateGhostAuth } from '@/lib/ghost-auth'

/**
 * GET /ghost/api/v4/admin/site - Get site information (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest) {
  console.log('👻 GET /api/ghost/admin/site handler called')
  console.log('👻 Site request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')
    
    console.log('👻 Site query params:', { domain, subdomain, blogSlug })

    // Validate authentication and find blog
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('👻 Site authentication failed')
      return authResult.error
    }
    
    const { blog } = authResult
    console.log('👻 Site authentication successful, blog:', blog.title)

    // Generate blog URL
    const blogUrl = blog.customDomain 
      ? `https://${blog.customDomain}`
      : blog.subdomain
      ? `https://${blog.subdomain}.from.cafe`
      : `https://from.cafe/${blog.user.slug || 'blog'}/${blog.slug}`

    // Return Ghost-compatible site information - match real Ghost exactly
    const siteResponse = {
      site: {
        title: blog.title,
        description: blog.description || '',
        logo: null,
        icon: null,
        cover_image: null,
        accent_color: '#15171A',
        locale: 'en',
        url: blogUrl,
        version: '5.120', // Use current Ghost version like real Ghost
        allow_external_signup: true // Critical field that real Ghost includes
      }
    }
    
    console.log('👻 Site response:', JSON.stringify(siteResponse, null, 2))
    
    return NextResponse.json(siteResponse, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ghost-Version': '5.120.3',
        'Content-Version': 'v5.120'
      }
    })

  } catch (error) {
    console.error('Error getting Ghost site info:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/ghost/admin/site - Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  console.log('👻 OPTIONS /api/ghost/admin/site handler called')
  console.log('👻 Site OPTIONS request headers:', Object.fromEntries(request.headers.entries()))
  
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