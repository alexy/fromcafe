import { NextRequest, NextResponse } from 'next/server'
import { findBlogByIdentifierExtended } from '@/lib/ghost-auth'

/**
 * GET /ghost/api/v4/admin/site - Get site information (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest) {
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')

    // Find the blog by URL structure
    const blog = await findBlogByIdentifierExtended(domain || undefined, subdomain || undefined, blogSlug || undefined)
    if (!blog) {
      return NextResponse.json(
        { errors: [{ message: 'Blog not found for this URL' }] },
        { status: 404 }
      )
    }

    // Generate blog URL
    const blogUrl = blog.customDomain 
      ? `https://${blog.customDomain}`
      : blog.subdomain
      ? `https://${blog.subdomain}.from.cafe`
      : `https://from.cafe/${blog.user.slug || 'blog'}/${blog.slug}`

    // Return Ghost-compatible site information
    return NextResponse.json({
      site: {
        title: blog.title,
        description: blog.description || '',
        url: blogUrl,
        version: '5.0.0', // Fake Ghost version
        timezone: 'UTC',
        locale: 'en',
        navigation: [],
        secondary_navigation: [],
        meta_title: blog.title,
        meta_description: blog.description || '',
        og_image: null,
        og_title: blog.title,
        og_description: blog.description || '',
        twitter_image: null,
        twitter_title: blog.title,
        twitter_description: blog.description || '',
        facebook: null,
        twitter: null,
        lang: 'en',
        accent_color: '#15171A',
        icon: null,
        logo: null,
        cover_image: null
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