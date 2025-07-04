import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchBlogData, generateBlogMetadata, BlogRenderer } from '@/lib/blog/renderer'

interface UserBlogPageProps {
  params: Promise<{ slug: string; blogSlug: string }>
}

export async function generateMetadata({ params }: UserBlogPageProps): Promise<Metadata> {
  const { slug, blogSlug } = await params
  const blog = await fetchBlogData({
    userSlug: slug,
    blogSlug: blogSlug
  })

  if (!blog) {
    return { title: 'Blog Not Found' }
  }

  return generateBlogMetadata(blog)
}

export default async function UserBlogPage({ params }: UserBlogPageProps) {
  const { slug, blogSlug } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const blog = await fetchBlogData({
    userSlug: slug,
    blogSlug: blogSlug
  })

  if (!blog) {
    notFound()
  }

  return <BlogRenderer blog={blog} hostname={hostname} />
}