import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateGhostAuth } from '@/lib/ghost-auth'

/**
 * GET /ghost/api/v4/admin/tags - Get tags (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest) {
  console.log('👻 GET /api/ghost/admin/tags handler called')
  
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')
    const include = searchParams.get('include') || '0'
    const limit = parseInt(searchParams.get('limit') || '1000')
    
    console.log('👻 GET tags query params:', { domain, subdomain, blogSlug, include, limit })

    // Validate authentication and find blog
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('👻 Tags authentication failed')
      return authResult.error
    }
    
    const { blog } = authResult
    console.log('👻 Tags authentication successful, blog ID:', blog.id)

    // Get tags for this blog
    const tags = await prisma.tag.findMany({
      where: {
        blogId: blog.id
      },
      orderBy: { name: 'asc' },
      take: limit,
      include: {
        postTags: include !== '0' ? {
          include: {
            post: true
          }
        } : false
      }
    })
    
    console.log('👻 Found', tags.length, 'tags for blog')

    // Convert to Ghost format
    const ghostTags = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description || null,
      feature_image: null,
      visibility: tag.visibility,
      meta_title: null,
      meta_description: null,
      og_image: null,
      og_title: null,
      og_description: null,
      twitter_image: null,
      twitter_title: null,
      twitter_description: null,
      codeinjection_head: null,
      codeinjection_foot: null,
      canonical_url: null,
      accent_color: null,
      created_at: tag.createdAt.toISOString(),
      updated_at: tag.updatedAt.toISOString(),
      count: include !== '0' ? {
        posts: tag.postTags?.length || 0
      } : undefined
    }))

    return NextResponse.json({
      tags: ghostTags,
      meta: {
        pagination: {
          page: 1,
          limit: limit,
          pages: 1,
          total: tags.length,
          next: null,
          prev: null
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ghost-Version': '5.0.0'
      }
    })

  } catch (error) {
    console.error('👻 Error getting Ghost tags:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/ghost/admin/tags - Handle CORS preflight requests
 */
export async function OPTIONS() {
  console.log('👻 OPTIONS /api/ghost/admin/tags handler called')
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Version',
      'Content-Type': 'application/json',
      'X-Ghost-Version': '5.0.0'
    }
  })
}