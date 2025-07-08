import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isCustomDomain, getPrimaryDomain } from '@/config/domains'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  
  // Early return for static assets to reduce processing
  if (pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico|webp)$/)) {
    return NextResponse.next()
  }
  
  // Handle Ghost admin interface (non-API routes)
  if (pathname.startsWith('/ghost') && !pathname.startsWith('/ghost/api/')) {
    console.log('👻 Ghost admin interface request:', pathname)
    // Redirect to our dashboard instead of Ghost admin
    const dashboardUrl = new URL('/dashboard', request.url)
    console.log('🔄 Redirecting Ghost admin to dashboard:', dashboardUrl.toString())
    return NextResponse.redirect(dashboardUrl)
  }

  // Handle Ghost admin dashboard editor requests (with hash fragments)
  if (pathname === '/dashboard' && request.headers.get('referer')?.includes('ulysses-ghost://')) {
    console.log('👻 Dashboard access from Ulysses Ghost admin context')
    // Allow the request to proceed to dashboard
    return NextResponse.next()
  }

  // Handle Ghost API routes specially for blog-specific domains
  if (pathname.startsWith('/ghost/api/')) {
    console.log('👻 Ghost API request detected:', request.method, pathname, 'on hostname:', hostname)
    console.log('👻 Original request URL:', request.url)
    console.log('👻 Request content-length:', request.headers.get('content-length') || 'NOT SET')
    
    // Special logging for PUT requests to debug the image update issue
    if (request.method === 'PUT') {
      console.log('🚨 MIDDLEWARE: PUT request detected to Ghost API')
      console.log('🚨 MIDDLEWARE: PUT pathname:', pathname)
      console.log('🚨 MIDDLEWARE: PUT headers:', Object.fromEntries(request.headers.entries()))
    }
    
    if (isCustomDomain(hostname)) {
      // Custom domain Ghost API: customdomain.com/ghost/api/v4/admin/site → /api/ghost/admin/site?domain=customdomain.com
      const url = request.nextUrl.clone()
      url.pathname = pathname.replace('/ghost/api/v4/admin/', '/api/ghost/admin/')
      url.pathname = url.pathname.replace('/ghost/api/admin/', '/api/ghost/admin/')
      url.searchParams.set('domain', hostname)
      console.log('🔄 Rewriting custom domain Ghost API:', pathname, '→', url.pathname, 'with search params:', url.searchParams.toString())
      console.log('👻 Final rewrite URL:', url.toString())
      return NextResponse.rewrite(url)
    }
    
    const subdomain = getSubdomain(hostname)
    if (subdomain) {
      // Subdomain Ghost API: subdomain.from.cafe/ghost/api/v4/admin/site → /api/ghost/admin/site?subdomain=subdomain
      const url = request.nextUrl.clone()
      url.pathname = pathname.replace('/ghost/api/v4/admin/', '/api/ghost/admin/')
      url.pathname = url.pathname.replace('/ghost/api/admin/', '/api/ghost/admin/')
      url.searchParams.set('subdomain', subdomain)
      console.log('🔄 Rewriting subdomain Ghost API:', pathname, '→', url.pathname)
      console.log('👻 Final rewritten URL with params:', url.toString())
      return NextResponse.rewrite(url)
    }
    
    // Main domain with path: from.cafe/anthropology/ghost/api/v4/admin/site
    const pathSegments = pathname.split('/').filter(Boolean)
    if (pathSegments.length >= 5 && pathSegments[1] === 'ghost' && pathSegments[2] === 'api') {
      // Extract blog slug from path: /anthropology/ghost/api/v4/admin/site
      const blogSlug = pathSegments[0] // 'anthropology'
      const url = request.nextUrl.clone()
      url.pathname = pathname.replace(`/${blogSlug}/ghost/api/v4/admin/`, '/api/ghost/admin/')
      url.pathname = url.pathname.replace(`/${blogSlug}/ghost/api/admin/`, '/api/ghost/admin/')
      url.searchParams.set('blogSlug', blogSlug)
      console.log('🔄 Rewriting path-based Ghost API:', pathname, '→', url.pathname)
      return NextResponse.rewrite(url)
    }
  }

  // Skip middleware for other API routes, static files, preview routes, and special Next.js routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/preview/') || // Skip preview routes
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/apple-touch-icon') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.xml') ||
    pathname.endsWith('.txt')
  ) {
    return NextResponse.next()
  }
  
  // Check if this is a custom domain using configuration
  const isCustomDomainHost = isCustomDomain(hostname)
  
  if (isCustomDomainHost) {
    console.log('🌍 Custom domain detected:', hostname, 'for path:', pathname)
    
    // Prevent dashboard access on custom domains
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/auth')) {
      console.log('🚫 Blocking admin path on custom domain:', pathname)
      return NextResponse.redirect(`https://${getPrimaryDomain()}${pathname}`)
    }
    
    // Route custom domain to custom domain handler
    const url = request.nextUrl.clone()
    if (pathname === '/') {
      // Custom domain root - show blog
      url.pathname = `/custom-domain`
    } else {
      // Custom domain with path - extract clean slug
      // Handle both clean URLs (/post-slug) and complex URLs (/user/blog/post-slug)
      const pathSegments = pathname.split('/').filter(Boolean)
      
      if (pathSegments.length === 1) {
        // Already clean: /post-slug
        url.pathname = `/custom-domain/${pathSegments[0]}`
      } else if (pathSegments.length >= 3) {
        // Complex path: /user/blog/post-slug -> extract post-slug
        const postSlug = pathSegments[pathSegments.length - 1]
        url.pathname = `/custom-domain/${postSlug}`
      } else {
        // Fallback: preserve path as-is
        url.pathname = `/custom-domain${pathname}`
      }
    }
    console.log('🔄 Rewriting custom domain:', pathname, '→', url.pathname)
    return NextResponse.rewrite(url)
  }
  
  // Extract subdomain from hostname
  const subdomain = getSubdomain(hostname)
  
  // Skip subdomain routing for main domain paths
  if (!subdomain) {
    // Main domain - allow normal routing for auth, admin, dashboard
    if (
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/onboarding') ||
      pathname === '/'
    ) {
      return NextResponse.next()
    }
    
    // Legacy blog routes for backwards compatibility
    if (pathname.startsWith('/blog/')) {
      return NextResponse.next()
    }
    
    // Path-based user routing (/{userSlug}/{blogSlug})
    return NextResponse.next()
  }
  
  // Subdomain detected - could be user subdomain or blog subdomain
  // Only log for actual page requests (not assets)
  if (!pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico|webp)$/)) {
    console.log('🌐 Subdomain detected:', subdomain, 'for path:', pathname, 'from hostname:', hostname)
  }
  
  // Check if the path already includes the subdomain (to avoid double-rewriting)
  if (pathname.startsWith(`/${subdomain}/`) || pathname === `/${subdomain}`) {
    // Only log for actual page requests (not assets)
    if (!pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico|webp)$/)) {
      console.log('🔄 Path already includes subdomain, passing through:', pathname)
    }
    return NextResponse.next()
  }
  
  const url = request.nextUrl.clone()
  
  // For blog subdomains (like anthropology.from.cafe), we need to check if it's a blog
  // and route directly to the blog content without user slug
  
  // First, try blog subdomain routing: subdomain.from.cafe → blog content
  // We'll use a special route that can handle blog subdomains
  url.pathname = `/blog-subdomain/${subdomain}${pathname}`
  console.log('🔄 Rewriting blog subdomain:', pathname, '→', url.pathname)
  return NextResponse.rewrite(url)
}

// Helper function to extract subdomain from hostname
function getSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0]
  
  // Check for subdomain patterns
  if (host.includes('.from.cafe')) {
    const subdomain = host.replace('.from.cafe', '')
    // Skip www and root domain
    if (subdomain && subdomain !== 'www' && subdomain !== 'from') {
      return subdomain
    }
  }
  
  // For Vercel preview deployments (optional)
  if (host.includes('.vercel.app')) {
    const parts = host.split('.')
    if (parts.length > 3) {
      // Extract subdomain from vercel preview URLs like tales-app.vercel.app
      const subdomain = parts[0].split('-')[0]
      if (subdomain && subdomain !== 'www') {
        return subdomain
      }
    }
  }
  
  return null
}

export const config = {
  matcher: [
    // Exclude API routes, static files, images, and common assets from middleware
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    // Note: File extension filtering is now handled in the middleware code itself
  ],
}