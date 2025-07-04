import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchBlogData, generateBlogMetadata, BlogRenderer } from '@/lib/blog/renderer'

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
  
  console.log('🌍 Custom domain blog page loading for:', hostname)
  
  const blog = await fetchBlogData({
    customDomain: hostname
  })

  if (!blog) {
    console.log('❌ No blog found for custom domain:', hostname)
    notFound()
  }

  console.log('✅ Blog found for custom domain:', {
    hostname,
    blogTitle: blog.title,
    blogSlug: blog.slug
  })

  return <BlogRenderer blog={blog} hostname={hostname} />
}