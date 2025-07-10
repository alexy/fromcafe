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

    // Generate blog URL
    const blogUrl = blog.customDomain 
      ? `https://${blog.customDomain}`
      : blog.subdomain
      ? `https://${blog.subdomain}.from.cafe`
      : `https://from.cafe/${blog.user.slug || 'blog'}/${blog.slug}`

    // Return Ghost-compatible configuration that indicates full feature support
    return NextResponse.json({
      config: {
        version: '5.120',
        environment: 'production',
        database: 'mysql8',
        mail: {
          transport: 'SMTP'
        },
        labs: {
          // Enable all modern Ghost features to indicate full compatibility
          members: true,
          stripeConnected: false,
          ghostPayments: false,
          oauthLogin: false,
          emailAnalytics: true,
          audienceFeedback: true,
          websitePreview: true,
          lexicalEditor: true, // Critical: indicates Lexical format support
          emailClicks: true,
          newsletterAnalytics: true,
          sourceAttribution: true,
          improvedOnboarding: false
        },
        enableDeveloperExperiments: false,
        stripePlans: [],
        useGravatar: true,
        isPrivate: false,
        passwordProtected: false,
        emailVerification: false,
        publicHash: 'abc123def456',
        blogUrl: blogUrl,
        blogTitle: blog.title,
        // Image capabilities - critical for Ulysses validation
        imageOptimization: {
          responsive: true,
          srcsets: true
        },
        // File upload settings
        fileStorage: true,
        imageUpload: true, // Explicitly indicate image upload support
        // Editor capabilities  
        editor: {
          url: blogUrl,
          version: '5.120'
        },
        // Timezone and locale
        timezone: 'UTC',
        locale: 'en'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ghost-Version': '5.120'
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