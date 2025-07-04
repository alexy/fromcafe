import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const resolvedParams = await params
    const subdomain = resolvedParams.subdomain

    // Find blog by subdomain
    const blog = await prisma.blog.findFirst({
      where: {
        subdomain: subdomain,
        urlFormat: 'subdomain',
        isPublic: true
      },
      include: {
        user: {
          select: {
            slug: true
          }
        },
        posts: {
          where: {
            isPublished: true
          },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            publishedAt: true,
            isPublished: true
          },
          orderBy: {
            publishedAt: 'desc'
          }
        }
      }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    return NextResponse.json({ blog })
  } catch (error) {
    console.error('Error fetching blog by subdomain:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}