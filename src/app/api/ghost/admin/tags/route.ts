import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findBlogByIdentifier } from '@/lib/ghost-auth'

/**
 * GET /ghost/api/v4/admin/tags - Get tags (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest) {
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')
    const include = searchParams.get('include') || '0'
    const limit = parseInt(searchParams.get('limit') || '1000')

    // Find the blog by URL structure
    const blog = await findBlogByIdentifier(domain || undefined, subdomain || undefined, blogSlug || undefined)
    if (!blog) {
      return NextResponse.json(
        { errors: [{ message: 'Blog not found for this URL' }] },
        { status: 404 }
      )
    }

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
    })

  } catch (error) {
    console.error('Error getting Ghost tags:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}