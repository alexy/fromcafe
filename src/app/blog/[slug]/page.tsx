import 'server-only'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import { getTheme, getDefaultTheme } from '@/lib/themes/registry'

interface BlogPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const blog = await prisma.blog.findUnique({
    where: { slug: resolvedParams.slug },
    include: { user: true },
  })

  if (!blog) {
    return {
      title: 'Blog Not Found',
    }
  }

  return {
    title: blog.title,
    description: blog.description,
  }
}

export default async function BlogPage({ params }: BlogPageProps) {
  const resolvedParams = await params
  const blog = await prisma.blog.findUnique({
    where: { slug: resolvedParams.slug },
    include: {
      user: true,
      posts: {
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
      },
    },
  })

  if (!blog || !blog.isPublic) {
    notFound()
  }

  // Get the theme for this blog
  const theme = getTheme(blog.theme) || getDefaultTheme()
  const { BlogLayout } = theme.components

  return (
    <BlogLayout
      blog={blog}
      posts={blog.posts}
    />
  )
}