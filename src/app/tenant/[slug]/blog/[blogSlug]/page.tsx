import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import { themes } from '@/lib/themes/registry'

interface TenantBlogPageProps {
  params: { slug: string; blogSlug: string }
}

export async function generateMetadata({ params }: TenantBlogPageProps): Promise<Metadata> {
  const blog = await prisma.blog.findFirst({
    where: { 
      slug: params.blogSlug,
      tenant: { slug: params.slug },
      isPublic: true
    },
    include: { tenant: true }
  })

  if (!blog) {
    return { title: 'Blog Not Found' }
  }

  return {
    title: `${blog.title} - ${blog.tenant?.name || 'FromCafe'}`,
    description: blog.description || `${blog.title} blog`
  }
}

export default async function TenantBlogPage({ params }: TenantBlogPageProps) {
  const blog = await prisma.blog.findFirst({
    where: { 
      slug: params.blogSlug,
      tenant: { slug: params.slug },
      isPublic: true
    },
    include: {
      tenant: true,
      posts: {
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' }
      }
    }
  })

  if (!blog || !blog.tenant?.isActive) {
    notFound()
  }

  // Get theme component
  const ThemeComponent = themes[blog.theme as keyof typeof themes]?.BlogLayout || themes.default.BlogLayout

  return (
    <ThemeComponent
      blog={{
        id: blog.id,
        title: blog.title,
        description: blog.description,
        slug: blog.slug,
        customDomain: blog.customDomain,
        theme: blog.theme,
        isPublic: blog.isPublic,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt,
        tenantSlug: blog.tenant.slug
      }}
      posts={blog.posts.map(post => ({
        id: post.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        slug: post.slug,
        isPublished: post.isPublished,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        blogSlug: blog.slug,
        tenantSlug: blog.tenant.slug
      }))}
    />
  )
}