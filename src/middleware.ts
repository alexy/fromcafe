import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')
  const pathname = request.nextUrl.pathname
  
  // Skip middleware for API routes, static files, and special Next.js routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next()
  }
  
  // Skip middleware for auth routes
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }
  
  // Skip middleware for dashboard routes (keep existing behavior)
  if (pathname.startsWith('/dashboard/')) {
    return NextResponse.next()
  }
  
  // Skip middleware for legacy blog routes (keep existing behavior)
  if (pathname.startsWith('/blog/')) {
    return NextResponse.next()
  }
  
  // Skip middleware for tenant routes (already path-based)
  if (pathname.startsWith('/tenant/')) {
    return NextResponse.next()
  }
  
  // For now, just pass through - we'll implement subdomain handling later
  // when we deploy to Vercel and test actual subdomain routing
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Exclude API routes, static files, and images from middleware
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}