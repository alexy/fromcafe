import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchBlogData, generateBlogMetadata, BlogRenderer } from '@/lib/blog/renderer'

interface SubdomainBlogPageProps {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ tag?: string }>
}

export async function generateMetadata({ params }: SubdomainBlogPageProps): Promise<Metadata> {
  const { subdomain } = await params
  const blog = await fetchBlogData({
    subdomain: subdomain
  })

  if (!blog) {
    return { title: 'Blog Not Found' }
  }

  return generateBlogMetadata(blog)
}

export default async function SubdomainBlogPage({ params, searchParams }: SubdomainBlogPageProps) {
  const { subdomain } = await params
  const { tag } = await searchParams
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const blog = await fetchBlogData({
    subdomain: subdomain
  }, tag)

  if (!blog) {
    notFound()
  }

  return <BlogRenderer blog={blog} hostname={hostname} currentTag={tag} />
}