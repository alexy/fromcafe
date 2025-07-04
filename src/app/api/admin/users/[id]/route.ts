import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { siteConfig } from '@/config/site'
import { UserRole } from '@prisma/client'

interface AdminUserUpdateProps {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: AdminUserUpdateProps) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    
    // Check if user is admin
    const admin = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if admin user management is allowed
    if (!siteConfig.admin.allowUserRoleChange) {
      return NextResponse.json({ error: 'User role changes are disabled' }, { status: 403 })
    }

    const { role, isActive } = await request.json()

    // Validate role
    if (role && !['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // If trying to demote current admin, check if other admins exist
    if (id === session.user.id && role === 'USER') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true }
      })
      
      if (adminCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot demote yourself - at least one admin must remain' 
        }, { status: 400 })
      }
    }

    // Prevent admin from deactivating themselves if they're the only admin
    if (id === session.user.id && isActive === false) {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true }
      })
      
      if (adminCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot deactivate yourself - at least one admin must remain active' 
        }, { status: 400 })
      }
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build update data
    const updateData: { role?: UserRole; isActive?: boolean } = {}
    if (role !== undefined) updateData.role = role as UserRole
    if (isActive !== undefined) updateData.isActive = isActive

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        slug: true,
        role: true,
        isActive: true
      }
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}