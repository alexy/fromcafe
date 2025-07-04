import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { themes } from '@/lib/themes/registry'

interface SubdomainBlogPageProps {
  params: Promise<{ subdomain: string }>
}

export async function generateMetadata({ params }: SubdomainBlogPageProps): Promise<Metadata> {
  const { subdomain } = await params
  const blog = await prisma.blog.findFirst({
    where: { 
      subdomain: subdomain,
      urlFormat: 'subdomain',
      isPublic: true
    },
    include: { user: true }
  })

  if (!blog) {
    return { title: 'Blog Not Found' }
  }

  return {
    title: `${blog.title} - ${blog.user.displayName || 'FromCafe'}`,
    description: blog.description || `${blog.title} blog`
  }
}

export default async function SubdomainBlogPage({ params }: SubdomainBlogPageProps) {
  const { subdomain } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const blog = await prisma.blog.findFirst({
    where: { 
      subdomain: subdomain,
      urlFormat: 'subdomain',
      isPublic: true
    },
    include: {
      user: true,
      posts: {
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' }
      }
    }
  })

  if (!blog || !blog.user.isActive) {
    notFound()
  }

  // Get theme component
  const ThemeComponent = themes[blog.theme as keyof typeof themes]?.components.BlogLayout || themes.default.components.BlogLayout

  // Type-safe props with null to undefined conversion
  const blogProps = {
    id: blog.id,
    title: blog.title,
    description: blog.description ?? undefined,
    slug: blog.slug,
    author: blog.author ?? undefined,
    customDomain: blog.customDomain ?? undefined,
    theme: blog.theme,
    isPublic: blog.isPublic,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
    userSlug: blog.user.slug ?? undefined
  }

  const postsProps = blog.posts.map(post => ({
    id: post.id,
    title: post.title,
    content: post.content,
    excerpt: post.excerpt ?? undefined,
    slug: post.slug,
    isPublished: post.isPublished,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    blogSlug: blog.slug,
    userSlug: blog.user.slug ?? undefined
  }))

  return (
    <ThemeComponent
      blog={blogProps}
      posts={postsProps}
      hostname={hostname}
    />
  )
}