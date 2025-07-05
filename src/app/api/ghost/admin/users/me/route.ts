import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateGhostAuth } from '@/lib/ghost-auth'

// Removed duplicate functions - now using shared ghost-auth module

/**
 * GET /ghost/api/v4/admin/users/me - Get current user information (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest) {
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')

    // Validate authentication and find blog
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      return authResult.error
    }
    
    const { tokenData } = authResult

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        slug: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { errors: [{ message: 'User not found' }] },
        { status: 404 }
      )
    }

    // Return Ghost-compatible user information
    return NextResponse.json({
      users: [{
        id: user.id,
        name: user.displayName || user.email || 'User',
        slug: user.slug || 'user',
        email: user.email,
        profile_image: null,
        cover_image: null,
        bio: null,
        website: null,
        location: null,
        facebook: null,
        twitter: null,
        accessibility: null,
        status: 'active',
        meta_title: null,
        meta_description: null,
        tour: null,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        roles: [{
          id: 'owner',
          name: 'Owner',
          description: 'Blog owner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
      }]
    })

  } catch (error) {
    console.error('Error getting Ghost user info:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}