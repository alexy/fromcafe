import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'

interface PostPageProps {
  params: {
    slug: string
    postSlug: string
  }
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await prisma.post.findFirst({
    where: {
      slug: params.postSlug,
      blog: { slug: params.slug },
      isPublished: true,
    },
    include: { blog: true },
  })

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  return {
    title: `${post.title} | ${post.blog.title}`,
    description: post.excerpt,
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await prisma.post.findFirst({
    where: {
      slug: params.postSlug,
      blog: { slug: params.slug },
      isPublished: true,
    },
    include: {
      blog: {
        include: { user: true },
      },
    },
  })

  if (!post || !post.blog.isPublic) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4">
          <nav className="mb-4">
            <a
              href={`/blog/${post.blog.slug}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              ← Back to {post.blog.title}
            </a>
          </nav>
          <h1 className="text-4xl font-bold mb-2">{post.title}</h1>
          <div className="text-gray-300">
            <p>By {post.blog.user.name || post.blog.user.email}</p>
            <time className="text-sm">
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
            </time>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <article className="max-w-4xl mx-auto">
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>
      </main>
    </div>
  )
}