import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchPostData, generatePostMetadata, PostRenderer } from '@/lib/blog/renderer'

interface UserPostPageProps {
  params: Promise<{ slug: string; blogSlug: string; postSlug: string }>
}

export async function generateMetadata({ params }: UserPostPageProps): Promise<Metadata> {
  const { slug, blogSlug, postSlug } = await params
  const post = await fetchPostData({
    userSlug: slug,
    blogSlug: blogSlug,
    postSlug: postSlug
  })

  if (!post) {
    return { title: 'Post Not Found' }
  }

  return generatePostMetadata(post)
}

export default async function UserPostPage({ params }: UserPostPageProps) {
  const { slug, blogSlug, postSlug } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  const post = await fetchPostData({
    userSlug: slug,
    blogSlug: blogSlug,
    postSlug: postSlug
  })

  if (!post) {
    notFound()
  }

  return <PostRenderer post={post} hostname={hostname} />
}