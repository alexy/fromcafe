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
    const tenants = await prisma.tenant.findMany({
      where: {
        tenantUsers: {
          some: {
            userId: session.user.id
          }
        }
      },
      include: {
        tenantUsers: {
          where: {
            userId: session.user.id
          },
          select: {
            role: true
          }
        },
        blogs: {
          select: {
            id: true,
            title: true,
            slug: true,
            isPublic: true
          }
        },
        _count: {
          select: {
            blogs: true
          }
        }
      }
    })

    return NextResponse.json({ tenants })
  } catch (error) {
    console.error('Error fetching tenants:', error)
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, slug, subdomain } = body

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    // Check if slug is already taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug }
    })

    if (existingTenant) {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 400 })
    }

    // Check if subdomain is already taken
    if (subdomain) {
      const existingSubdomain = await prisma.tenant.findUnique({
        where: { subdomain }
      })

      if (existingSubdomain) {
        return NextResponse.json({ error: 'Subdomain already taken' }, { status: 400 })
      }
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        subdomain,
        tenantUsers: {
          create: {
            userId: session.user.id,
            role: 'OWNER'
          }
        }
      },
      include: {
        tenantUsers: {
          where: {
            userId: session.user.id
          },
          select: {
            role: true
          }
        }
      }
    })

    return NextResponse.json({ tenant })
  } catch (error) {
    console.error('Error creating tenant:', error)
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 })
  }
}