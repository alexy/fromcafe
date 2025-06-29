import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')
  
  if (!hostname) {
    return NextResponse.next()
  }

  // Check if this is a custom domain
  const customDomain = await prisma.domain.findFirst({
    where: {
      domain: hostname,
      isVerified: true,
    },
    include: {
      blog: true,
    },
  })

  if (customDomain) {
    // Rewrite to the blog page
    const url = request.nextUrl.clone()
    url.pathname = `/blog/${customDomain.blog.slug}${url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}