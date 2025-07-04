import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if user is admin
    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    console.log('Admin check:', {
      userId: session.user.id,
      sessionRole: session.user.role,
      dbRole: admin?.role,
      isAdmin: admin?.role === 'ADMIN'
    })

    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get all users with their blog counts
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        slug: true,
        subdomain: true,
        domain: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { blogs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}