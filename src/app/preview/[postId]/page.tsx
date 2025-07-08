import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PostRenderer, generatePostMetadata } from '@/lib/blog/renderer'

interface PostPreviewPageProps {
  params: Promise<{ postId: string }>
}

export async function generateMetadata({ params }: PostPreviewPageProps): Promise<Metadata> {
  const { postId } = await params
  
  // Get session for authorization
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { title: 'Preview Not Available' }
  }

  // Convert Ghost post ID (24 chars) to database post lookup
  const post = await prisma.post.findFirst({
    where: {
      OR: [
        { ghostPostId: postId },
        { id: postId }
      ],
      blog: {
        userId: session.user.id
      }
    },
    include: { 
      blog: { 
        include: { user: true } 
      } 
    }
  })

  if (!post) {
    return { title: 'Preview Not Found' }
  }

  return generatePostMetadata(post)
}

export default async function PostPreviewPage({ params }: PostPreviewPageProps) {
  const { postId } = await params
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  // Get session for authorization
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    // Redirect to authentication on main domain
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/preview/${postId}`)}`)
  }

  // Find post by Ghost post ID or database ID, but only for posts owned by the current user
  const post = await prisma.post.findFirst({
    where: {
      OR: [
        { ghostPostId: postId },
        { id: postId }
      ],
      blog: {
        userId: session.user.id
      }
    },
    include: { 
      blog: { 
        include: { user: true } 
      } 
    }
  })

  if (!post) {
    notFound()
  }

  // Add a preview banner for draft posts
  const isPreview = !post.isPublished

  return (
    <div>
      {isPreview && (
        <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-yellow-800 font-medium">Draft Preview</span>
              <span className="text-yellow-600 text-sm">Only you can see this post</span>
            </div>
            <a
              href={`/dashboard/blogs/${post.blog.id}`}
              className="text-yellow-800 hover:text-yellow-900 text-sm font-medium underline"
            >
              Edit in Dashboard
            </a>
          </div>
        </div>
      )}
      <PostRenderer post={post} hostname={hostname} />
    </div>
  )
}