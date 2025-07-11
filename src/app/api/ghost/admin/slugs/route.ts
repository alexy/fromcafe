import { NextRequest, NextResponse } from 'next/server'
import { validateGhostAuth } from '@/lib/ghost-auth'

/**
 * POST /ghost/api/v4/admin/slugs - Generate URL-friendly slugs (Ghost Admin API compatible)
 * Used by publishing tools to generate unique slugs for posts, tags, etc.
 */
export async function POST(request: NextRequest) {
  console.log('👻 POST /api/ghost/admin/slugs handler called')
  console.log('👻 Slug generation request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')
    
    console.log('👻 Slug generation query params:', { domain, subdomain, blogSlug })

    // Validate authentication and find blog
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('👻 Slug generation authentication failed')
      return authResult.error
    }
    
    const { blog } = authResult
    console.log('👻 Slug generation authentication successful, blog ID:', blog.id)

    // Parse request body
    const body = await request.json()
    console.log('👻 Slug generation request body:', body)
    
    const { name, type = 'post' } = body
    
    if (!name) {
      return NextResponse.json(
        { errors: [{ message: 'Name is required for slug generation' }] },
        { status: 400 }
      )
    }
    
    // Generate slug from name
    const slug = generateSlug(name)
    console.log('👻 Generated slug:', slug, 'from name:', name)
    
    // Return Ghost-compatible slug response
    return NextResponse.json({
      slugs: [{
        slug: slug
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ghost-Version': '5.120.3',
        'Content-Version': 'v5.120'
      }
    })

  } catch (error) {
    console.error('👻 Error generating Ghost slug:', error)
    return NextResponse.json(
      { errors: [{ message: 'Failed to generate slug' }] },
      { status: 500 }
    )
  }
}

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .trim()
}

/**
 * OPTIONS /api/ghost/admin/slugs - Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  console.log('👻 OPTIONS /api/ghost/admin/slugs handler called')
  console.log('👻 Slug OPTIONS request headers:', Object.fromEntries(request.headers.entries()))
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Version',
      'Content-Type': 'application/json',
      'X-Ghost-Version': '5.120.3'
    }
  })
}