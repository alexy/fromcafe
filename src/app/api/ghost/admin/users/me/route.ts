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

    // Return Ghost-compatible user information - match real Ghost exactly
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
        accessibility: '{"nightShift":false,"whatsNew":{"lastSeenDate":"2025-07-10T06:00:00.000+00:00"}}',
        status: 'active',
        meta_title: null,
        meta_description: null,
        tour: null,
        last_seen: new Date().toISOString(),
        comment_notifications: true,
        free_member_signup_notification: true,
        paid_subscription_started_notification: true,
        paid_subscription_canceled_notification: false,
        mention_notifications: true,
        milestone_notifications: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        donation_notifications: true,
        recommendation_notifications: true,
        threads: null,
        bluesky: null,
        mastodon: null,
        tiktok: null,
        youtube: null,
        instagram: null,
        linkedin: null,
        url: null
        // Note: Real Ghost does NOT include roles field
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ghost-Version': '5.120.3',
        'Content-Version': 'v5.120'
      }
    })

  } catch (error) {
    console.error('Error getting Ghost user info:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}