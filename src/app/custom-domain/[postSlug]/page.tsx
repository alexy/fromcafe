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
  
  console.log('🌍 Custom domain post page loading for:', { hostname, postSlug })
  
  const post = await fetchPostData({
    customDomain: hostname,
    postSlug: postSlug
  })

  if (!post) {
    console.log('❌ No post found for custom domain:', { hostname, postSlug })
    notFound()
  }

  console.log('✅ Post found for custom domain:', {
    hostname,
    postSlug,
    postTitle: post.title,
    blogTitle: post.blog.title
  })

  return <PostRenderer post={post} hostname={hostname} />
}