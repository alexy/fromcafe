import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateUserSlug } from '@/config/site'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { displayName, slug, subdomain } = body

    // Validate required fields
    if (!displayName || !slug) {
      return NextResponse.json({ error: 'Display name and slug are required' }, { status: 400 })
    }

    // Validate slug format and reserved words
    const slugValidation = validateUserSlug(slug)
    if (!slugValidation.valid) {
      return NextResponse.json({ error: slugValidation.error }, { status: 400 })
    }

    // Check if user already has blog space setup
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (existingUser?.slug) {
      return NextResponse.json({ 
        error: 'User already has blog space setup',
        user: existingUser
      }, { status: 400 })
    }

    // Check if slug is already taken
    const existingSlug = await prisma.user.findUnique({
      where: { slug }
    })

    if (existingSlug) {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 400 })
    }

    // Check if subdomain is already taken
    if (subdomain) {
      const existingSubdomain = await prisma.user.findUnique({
        where: { subdomain }
      })

      if (existingSubdomain) {
        return NextResponse.json({ error: 'Subdomain already taken' }, { status: 400 })
      }
    }

    // Update user with blog space properties
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName,
        slug,
        subdomain
      }
    })

    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        slug: user.slug,
        subdomain: user.subdomain
      }
    })
  } catch (error) {
    console.error('Error completing signup:', error)
    return NextResponse.json({ error: 'Failed to complete signup' }, { status: 500 })
  }
}