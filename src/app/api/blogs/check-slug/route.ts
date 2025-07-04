import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'Slug parameter is required' }, { status: 400 })
    }

    const existingBlog = await prisma.blog.findFirst({
      where: { 
        slug,
        userId: session.user.id
      },
    })

    return NextResponse.json({ exists: !!existingBlog })
  } catch (error) {
    console.error('Error checking slug:', error)
    return NextResponse.json({ error: 'Failed to check slug' }, { status: 500 })
  }
}