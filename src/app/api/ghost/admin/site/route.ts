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

    // Return Ghost-compatible site information - match real Ghost exactly
    return NextResponse.json({
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
    })

  } catch (error) {
    console.error('Error getting Ghost site info:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}