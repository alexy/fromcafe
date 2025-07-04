import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { siteConfig } from '@/config/site'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { password } = await request.json()

    // Verify admin password
    if (password !== siteConfig.admin.password) {
      return NextResponse.json({ error: 'Invalid admin password' }, { status: 401 })
    }

    // Promote current user to admin
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true
      }
    })

    return NextResponse.json({ 
      message: 'Successfully promoted to admin',
      user: updatedUser,
      // Signal that the session should be updated
      updateSession: true
    })
  } catch (error) {
    console.error('Error promoting user to admin:', error)
    return NextResponse.json({ error: 'Failed to promote user' }, { status: 500 })
  }
}