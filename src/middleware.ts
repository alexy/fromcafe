import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  
  // Skip middleware for API routes, static files, and special Next.js routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
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
  
  // Check if this is a custom domain (not from.cafe or its subdomains)
  const isCustomDomain = !hostname.includes('from.cafe') && !hostname.includes('localhost') && !hostname.includes('vercel.app')
  
  if (isCustomDomain) {
    console.log('🌍 Custom domain detected:', hostname, 'for path:', pathname)
    
    // Prevent dashboard access on custom domains
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/auth')) {
      console.log('🚫 Blocking admin path on custom domain:', pathname)
      return NextResponse.redirect('https://from.cafe' + pathname)
    }
    
    // Route custom domain to custom domain handler
    const url = request.nextUrl.clone()
    if (pathname === '/') {
      // Custom domain root - show blog
      url.pathname = `/custom-domain`
    } else {
      // Custom domain with path - probably a post
      url.pathname = `/custom-domain${pathname}`
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
  console.log('🌐 Subdomain detected:', subdomain, 'for path:', pathname, 'from hostname:', hostname)
  
  // Check if the path already includes the subdomain (to avoid double-rewriting)
  if (pathname.startsWith(`/${subdomain}/`) || pathname === `/${subdomain}`) {
    console.log('🔄 Path already includes subdomain, passing through:', pathname)
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
    // Exclude API routes, static files, and images from middleware
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}