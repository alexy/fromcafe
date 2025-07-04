import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchPostData, generatePostMetadata, PostRenderer } from '@/lib/blog/renderer'

interface CustomDomainSlugPageProps {
  params: Promise<{ slug: string[] }>
}

export async function generateMetadata({ params }: CustomDomainSlugPageProps): Promise<Metadata> {
  const { slug } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  // Extract post slug from the path
  // For paths like /tales/field-notes/top-level-domain, we want just "top-level-domain"
  const postSlug = slug[slug.length - 1]
  
  const post = await fetchPostData({
    customDomain: hostname,
    postSlug: postSlug
  })

  if (!post) {
    return { title: 'Post Not Found' }
  }

  return generatePostMetadata(post)
}

export default async function CustomDomainSlugPage({ params }: CustomDomainSlugPageProps) {
  const { slug } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  console.log('🌍 Custom domain slug page loading for:', { hostname, slug })
  
  // Extract post slug from the path
  // For paths like /tales/field-notes/top-level-domain, we want just "top-level-domain"
  const postSlug = slug[slug.length - 1]
  
  console.log('🔍 Extracted post slug:', postSlug, 'from path:', slug)
  
  const post = await fetchPostData({
    customDomain: hostname,
    postSlug: postSlug
  })

  if (!post) {
    console.log('❌ No post found for custom domain:', { hostname, postSlug, fullPath: slug })
    notFound()
  }

  console.log('✅ Post found for custom domain:', {
    hostname,
    postSlug,
    fullPath: slug,
    postTitle: post.title,
    blogTitle: post.blog.title
  })

  return <PostRenderer post={post} hostname={hostname} />
}