import { NextRequest, NextResponse } from 'next/server'
import { validateGhostAuth } from '@/lib/ghost-auth'

/**
 * GET /ghost/api/admin/config - Get server configuration (Ghost Admin API compatible)
 * This endpoint tells clients what features/capabilities the server supports
 */
export async function GET(request: NextRequest) {
  console.log('👻 GET /api/ghost/admin/config handler called')
  console.log('👻 Config request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')
    
    console.log('👻 Config query params:', { domain, subdomain, blogSlug })

    // Validate authentication and find blog - REQUIRED for Ghost Admin API
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('👻 Config authentication failed')
      return authResult.error
    }
    
    const { blog } = authResult
    console.log('👻 Config authentication successful, blog ID:', blog.id)

    // Real Ghost config doesn't include dynamic blog URL

    // Return Ghost-compatible configuration matching real Ghost exactly
    return NextResponse.json({
      config: {
        version: '5.120.3',
        environment: 'production', 
        database: 'mysql8',
        mail: 'stub',
        useGravatar: true,
        labs: {
          audienceFeedback: true,
          i18n: true,
          themeErrorsNotification: true,
          announcementBar: true,
          customFonts: true,
          contentVisibility: true,
          members: true
        },
        clientExtensions: {},
        enableDeveloperExperiments: false,
        stripeDirect: false,
        mailgunIsConfigured: true,
        emailAnalytics: true,
        hostSettings: {
          limits: {
            customThemes: {
              disabled: false
            },
            emails: {
              maxPeriodic: 1000
            }
          },
          subscription: {
            active: true
          }
        },
        security: {
          staff: false,
          subscribers: false  
        },
        signupForm: false,
        tenor: {
          contentFilter: 'off',
          enabled: true
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
    console.error('👻 Error getting Ghost config:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/ghost/admin/config - Handle CORS preflight requests
 */
export async function OPTIONS() {
  console.log('👻 OPTIONS /api/ghost/admin/config handler called')
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Version',
      'Content-Type': 'application/json',
      'X-Ghost-Version': '5.120'
    }
  })
}