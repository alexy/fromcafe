import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { domain } = body

    // Check if user owns this domain
    const domainRecord = await prisma.domain.findFirst({
      where: {
        domain,
        blog: {
          userId: session.user.id,
        },
      },
      include: {
        blog: true,
      },
    })

    if (!domainRecord) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    }

    // Simple DNS verification - check if domain resolves to our IP
    // In production, you'd want more sophisticated verification
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(`http://${domain}`, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'FromCafe-DomainVerifier/1.0',
        },
      })
      
      clearTimeout(timeoutId)
      const isVerified = response.status < 500 // Basic check
      
      // Update domain verification status
      await prisma.domain.update({
        where: { id: domainRecord.id },
        data: { 
          isVerified,
          updatedAt: new Date(),
        },
      })

      return NextResponse.json({ 
        verified: isVerified,
        message: isVerified 
          ? 'Domain verified successfully!' 
          : 'Domain verification failed. Please check your DNS settings.',
      })
      
    } catch {
      return NextResponse.json({
        verified: false,
        message: 'Domain verification failed. Please check your DNS settings and try again.',
      })
    }

  } catch (error) {
    console.error('Error verifying domain:', error)
    return NextResponse.json({ error: 'Failed to verify domain' }, { status: 500 })
  }
}