import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchPostData, generatePostMetadata, PostRenderer } from '@/lib/blog/renderer'

interface SubdomainPostPageProps {
  params: Promise<{ subdomain: string; postSlug: string }>
}

export async function generateMetadata({ params }: SubdomainPostPageProps): Promise<Metadata> {
  const { subdomain, postSlug } = await params
  const post = await fetchPostData({
    subdomain: subdomain,
    postSlug: postSlug
  })

  if (!post) {
    return { title: 'Post Not Found' }
  }

  return generatePostMetadata(post)
}

export default async function SubdomainPostPage({ params }: SubdomainPostPageProps) {
  const { subdomain, postSlug } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const post = await fetchPostData({
    subdomain: subdomain,
    postSlug: postSlug
  })

  if (!post) {
    notFound()
  }

  return <PostRenderer post={post} hostname={hostname} />
}