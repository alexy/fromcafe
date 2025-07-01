import { NextResponse } from 'next/server'

export async function middleware() {
  // Middleware temporarily disabled to prevent Prisma Edge Runtime conflicts
  // TODO: Implement custom domain handling without Prisma
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Exclude API routes, static files, and images from middleware
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}