import 'server-only'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import { getTheme, getDefaultTheme } from '@/lib/themes/registry'

interface PostPageProps {
  params: Promise<{
    slug: string
    postSlug: string
  }>
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const post = await prisma.post.findFirst({
    where: {
      slug: resolvedParams.postSlug,
      blog: { slug: resolvedParams.slug },
      isPublished: true,
    },
    include: { blog: true },
  })

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  return {
    title: `${post.title} | ${post.blog.title}`,
    description: post.excerpt,
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const resolvedParams = await params
  const post = await prisma.post.findFirst({
    where: {
      slug: resolvedParams.postSlug,
      blog: { slug: resolvedParams.slug },
      isPublished: true,
    },
    include: {
      blog: {
        include: { user: true },
      },
    },
  })

  if (!post || !post.blog.isPublic) {
    notFound()
  }

  // Get the theme for this blog
  const theme = getTheme(post.blog.theme) || getDefaultTheme()
  const { PostLayout } = theme.components

  return (
    <PostLayout
      blog={post.blog}
      post={post}
    />
  )
}