import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import Link from 'next/link'

interface UserPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { slug } = await params
  const user = await prisma.user.findUnique({
    where: { slug },
    include: { blogs: true }
  })

  if (!user) {
    return { title: 'User Not Found' }
  }

  return {
    title: `${user.displayName} - FromCafe`,
    description: `${user.displayName} blogs on FromCafe platform`
  }
}

export default async function UserPage({ params }: UserPageProps) {
  const { slug } = await params
  const user = await prisma.user.findUnique({
    where: { slug },
    include: {
      blogs: {
        where: { isPublic: true },
        include: {
          posts: {
            where: { isPublished: true },
            orderBy: { publishedAt: 'desc' },
            take: 3
          }
        }
      }
    }
  })

  if (!user || !user.isActive) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{user.displayName}</h1>
        <p className="text-gray-600">
          Welcome to {user.displayName}&apos;s collection of blogs on FromCafe
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {user.blogs.map((blog) => (
          <div key={blog.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">
              <Link 
                href={`/${user.slug}/${blog.slug}`}
                className="hover:text-blue-600"
              >
                {blog.title}
              </Link>
            </h2>
            {blog.description && (
              <p className="text-gray-600 mb-4">{blog.description}</p>
            )}
            
            {blog.posts.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Recent Posts</h3>
                <ul className="space-y-1">
                  {blog.posts.map((post) => (
                    <li key={post.id}>
                      <Link 
                        href={`/${user.slug}/${blog.slug}/${post.slug}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {post.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {user.blogs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No public blogs available for this user.</p>
        </div>
      )}
    </div>
  )
}