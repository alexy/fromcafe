import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface TenantRouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: TenantRouteParams) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: params.id,
        tenantUsers: {
          some: {
            userId: session.user.id
          }
        }
      },
      include: {
        tenantUsers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        blogs: {
          select: {
            id: true,
            title: true,
            slug: true,
            isPublic: true,
            createdAt: true,
            lastSyncedAt: true
          }
        },
        domains: {
          select: {
            id: true,
            domain: true,
            type: true,
            isVerified: true,
            createdAt: true
          }
        }
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({ tenant })
  } catch (error) {
    console.error('Error fetching tenant:', error)
    return NextResponse.json({ error: 'Failed to fetch tenant' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: TenantRouteParams) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, subdomain, domain } = body

    // Check if user has permission to update this tenant
    const tenantUser = await prisma.tenantUser.findFirst({
      where: {
        tenantId: params.id,
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!tenantUser) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if subdomain is already taken by another tenant
    if (subdomain) {
      const existingSubdomain = await prisma.tenant.findFirst({
        where: { 
          subdomain,
          id: { not: params.id }
        }
      })

      if (existingSubdomain) {
        return NextResponse.json({ error: 'Subdomain already taken' }, { status: 400 })
      }
    }

    // Check if domain is already taken by another tenant
    if (domain) {
      const existingDomain = await prisma.tenant.findFirst({
        where: { 
          domain,
          id: { not: params.id }
        }
      })

      if (existingDomain) {
        return NextResponse.json({ error: 'Domain already taken' }, { status: 400 })
      }
    }

    // Update tenant
    const tenant = await prisma.tenant.update({
      where: { id: params.id },
      data: {
        name,
        subdomain,
        domain
      }
    })

    return NextResponse.json({ tenant })
  } catch (error) {
    console.error('Error updating tenant:', error)
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: TenantRouteParams) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if user is the owner of this tenant
    const tenantUser = await prisma.tenantUser.findFirst({
      where: {
        tenantId: params.id,
        userId: session.user.id,
        role: 'OWNER'
      }
    })

    if (!tenantUser) {
      return NextResponse.json({ error: 'Only tenant owners can delete tenants' }, { status: 403 })
    }

    // Delete tenant (cascade will handle related records)
    await prisma.tenant.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Tenant deleted successfully' })
  } catch (error) {
    console.error('Error deleting tenant:', error)
    return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 })
  }
}