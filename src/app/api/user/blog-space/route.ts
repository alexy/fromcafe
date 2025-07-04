import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user?.slug) {
      return NextResponse.json({ user: null })
    }

    console.log('🗃️ Blog space API returning user data:', {
      id: user.id,
      displayName: user.displayName,
      slug: user.slug,
      subdomain: user.subdomain,
      domain: user.domain,
      useSubdomain: user.useSubdomain,
      isActive: user.isActive,
      role: user.role
    })
    
    return NextResponse.json({ 
      user: {
        id: user.id,
        displayName: user.displayName,
        slug: user.slug,
        subdomain: user.subdomain,
        domain: user.domain,
        useSubdomain: user.useSubdomain,
        isActive: user.isActive,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Error fetching user blog space:', error)
    return NextResponse.json({ error: 'Failed to fetch blog space' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, subdomain, domain, useSubdomain } = body

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user?.slug) {
      return NextResponse.json({ error: 'No blog space found for user' }, { status: 404 })
    }

    // If user wants to use subdomain but hasn't set one, use their slug
    let finalSubdomain = subdomain
    if (useSubdomain && !subdomain) {
      finalSubdomain = user.slug
    }

    // Check if subdomain is already taken by another user
    if (finalSubdomain && finalSubdomain !== user.subdomain) {
      const existingSubdomain = await prisma.user.findFirst({
        where: { 
          subdomain: finalSubdomain,
          id: { not: user.id }
        }
      })

      if (existingSubdomain) {
        return NextResponse.json({ error: 'Subdomain already taken' }, { status: 400 })
      }
    }

    // Check if domain is already taken by another user
    if (domain && domain !== user.domain) {
      const existingDomain = await prisma.user.findFirst({
        where: { 
          domain,
          id: { not: user.id }
        }
      })

      if (existingDomain) {
        return NextResponse.json({ error: 'Domain already taken' }, { status: 400 })
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: name,
        subdomain: finalSubdomain,
        domain,
        useSubdomain
      }
    })

    return NextResponse.json({ 
      user: {
        id: updatedUser.id,
        displayName: updatedUser.displayName,
        slug: updatedUser.slug,
        subdomain: updatedUser.subdomain,
        domain: updatedUser.domain,
        useSubdomain: updatedUser.useSubdomain,
        isActive: updatedUser.isActive,
        role: updatedUser.role
      }
    })
  } catch (error) {
    console.error('Error updating user blog space:', error)
    return NextResponse.json({ error: 'Failed to update blog space' }, { status: 500 })
  }
}