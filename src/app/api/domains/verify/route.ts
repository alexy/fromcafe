import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDomainStatus, verifyDomain, VercelDomainError } from '@/lib/vercel-domains'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { blogId } = body

    if (!blogId) {
      return NextResponse.json({ error: 'BlogId is required' }, { status: 400 })
    }

    // Check if user owns the blog
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        userId: session.user.id
      }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found or unauthorized' }, { status: 404 })
    }

    if (!blog.customDomain) {
      return NextResponse.json({ error: 'Blog does not have a custom domain' }, { status: 400 })
    }

    const domain = blog.customDomain

    try {
      // First get current status
      const currentStatus = await getDomainStatus(domain)
      
      if (!currentStatus) {
        return NextResponse.json({ 
          error: 'Domain not found in Vercel project. Please add the domain first.' 
        }, { status: 404 })
      }

      // If already verified, return current status
      if (currentStatus.verified) {
        return NextResponse.json({
          success: true,
          verified: true,
          domain: domain,
          status: currentStatus
        })
      }

      // Attempt verification
      const verificationResult = await verifyDomain(domain)

      return NextResponse.json({
        success: true,
        verified: verificationResult.verified,
        domain: domain,
        status: verificationResult
      })

    } catch (vercelError) {
      if (vercelError instanceof VercelDomainError) {
        return NextResponse.json({ 
          error: `Domain verification failed: ${vercelError.message}`,
          code: vercelError.code
        }, { status: 400 })
      }
      
      throw vercelError
    }

  } catch (error) {
    console.error('Error verifying custom domain:', error)
    return NextResponse.json({ error: 'Failed to verify custom domain' }, { status: 500 })
  }
}