import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { themes } from '@/lib/themes/registry'

interface SubdomainPostPageProps {
  params: Promise<{ subdomain: string; postSlug: string }>
}

export async function generateMetadata({ params }: SubdomainPostPageProps): Promise<Metadata> {
  const { subdomain, postSlug } = await params
  const post = await prisma.post.findFirst({
    where: { 
      slug: postSlug,
      blog: { 
        subdomain: subdomain,
        urlFormat: 'subdomain',
        isPublic: true
      },
      isPublished: true
    },
    include: { 
      blog: { 
        include: { user: true } 
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

export default async function SubdomainPostPage({ params }: SubdomainPostPageProps) {
  const { subdomain, postSlug } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const post = await prisma.post.findFirst({
    where: { 
      slug: postSlug,
      blog: { 
        subdomain: subdomain,
        urlFormat: 'subdomain',
        isPublic: true
      },
      isPublished: true
    },
    include: { 
      blog: { 
        include: { user: true } 
      } 
    }
  })

  if (!post || !post.blog.user.isActive) {
    notFound()
  }

  // Get theme component
  const ThemeComponent = themes[post.blog.theme as keyof typeof themes]?.components.PostLayout || themes.default.components.PostLayout

  // Type-safe props with null to undefined conversion
  const postProps = {
    id: post.id,
    title: post.title,
    content: post.content,
    excerpt: post.excerpt ?? undefined,
    slug: post.slug,
    isPublished: post.isPublished,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    blogSlug: post.blog.slug,
    userSlug: post.blog.user.slug ?? undefined
  }

  const blogProps = {
    id: post.blog.id,
    title: post.blog.title,
    description: post.blog.description ?? undefined,
    slug: post.blog.slug,
    author: post.blog.author ?? undefined,
    customDomain: post.blog.customDomain ?? undefined,
    theme: post.blog.theme,
    isPublic: post.blog.isPublic,
    createdAt: post.blog.createdAt,
    updatedAt: post.blog.updatedAt,
    userSlug: post.blog.user.slug ?? undefined
  }

  return (
    <ThemeComponent
      post={postProps}
      blog={blogProps}
      hostname={hostname}
    />
  )
}