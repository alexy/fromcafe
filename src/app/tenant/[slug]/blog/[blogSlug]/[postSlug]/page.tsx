import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import { themes } from '@/lib/themes/registry'

interface TenantPostPageProps {
  params: { slug: string; blogSlug: string; postSlug: string }
}

export async function generateMetadata({ params }: TenantPostPageProps): Promise<Metadata> {
  const post = await prisma.post.findFirst({
    where: { 
      slug: params.postSlug,
      blog: { 
        slug: params.blogSlug,
        tenant: { slug: params.slug },
        isPublic: true
      },
      isPublished: true
    },
    include: { 
      blog: { 
        include: { tenant: true } 
      } 
    }
  })

  if (!post) {
    return { title: 'Post Not Found' }
  }

  return {
    title: `${post.title} - ${post.blog.title}`,
    description: post.excerpt || `${post.title} from ${post.blog.title}`
  }
}

export default async function TenantPostPage({ params }: TenantPostPageProps) {
  const post = await prisma.post.findFirst({
    where: { 
      slug: params.postSlug,
      blog: { 
        slug: params.blogSlug,
        tenant: { slug: params.slug },
        isPublic: true
      },
      isPublished: true
    },
    include: { 
      blog: { 
        include: { tenant: true } 
      } 
    }
  })

  if (!post || !post.blog.tenant?.isActive) {
    notFound()
  }

  // Get theme component
  const ThemeComponent = themes[post.blog.theme as keyof typeof themes]?.PostLayout || themes.default.PostLayout

  return (
    <ThemeComponent
      post={{
        id: post.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        slug: post.slug,
        isPublished: post.isPublished,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        blogSlug: post.blog.slug,
        tenantSlug: post.blog.tenant.slug
      }}
      blog={{
        id: post.blog.id,
        title: post.blog.title,
        description: post.blog.description,
        slug: post.blog.slug,
        customDomain: post.blog.customDomain,
        theme: post.blog.theme,
        isPublic: post.blog.isPublic,
        createdAt: post.blog.createdAt,
        updatedAt: post.blog.updatedAt,
        tenantSlug: post.blog.tenant.slug
      }}
    />
  )
}