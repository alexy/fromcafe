import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchPostData, generatePostMetadata, PostRenderer } from '@/lib/blog/renderer'

interface CustomDomainPostPageProps {
  params: Promise<{ postSlug: string }>
}

export async function generateMetadata({ params }: CustomDomainPostPageProps): Promise<Metadata> {
  const { postSlug } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const post = await fetchPostData({
    customDomain: hostname,
    postSlug: postSlug
  })

  if (!post) {
    return { title: 'Post Not Found' }
  }

  return generatePostMetadata(post)
}

export default async function CustomDomainPostPage({ params }: CustomDomainPostPageProps) {
  const { postSlug } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const post = await fetchPostData({
    customDomain: hostname,
    postSlug: postSlug
  })

  if (!post) {
    notFound()
  }

  return <PostRenderer post={post} hostname={hostname} />
}