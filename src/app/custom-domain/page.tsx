import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchBlogData, generateBlogMetadata, BlogRenderer } from '@/lib/blog/renderer'

// This page would be used for custom domain routing
// e.g., when someone visits myblog.com directly
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const blog = await fetchBlogData({
    customDomain: hostname
  })

  if (!blog) {
    return { title: 'Blog Not Found' }
  }

  return generateBlogMetadata(blog)
}

export default async function CustomDomainBlogPage() {
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const blog = await fetchBlogData({
    customDomain: hostname
  })

  if (!blog) {
    notFound()
  }

  return <BlogRenderer blog={blog} hostname={hostname} />
}