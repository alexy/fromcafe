import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

interface UserDashboardProps {
  params: Promise<{ slug: string }>
}

export default async function UserDashboard({ params }: UserDashboardProps) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const { slug } = await params

  // Check if user owns this blog space
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { 
      blogs: {
        include: {
          _count: {
            select: { posts: true }
          }
        }
      }
    }
  })

  if (!user?.slug || user.slug !== slug) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{user.displayName} Dashboard</h1>
            <p className="text-gray-600">
              Manage your blogs and content for {user.displayName}
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                OWNER
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              Main Dashboard
            </Link>
            <Link
              href="/api/auth/signout"
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Sign Out
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/${user.slug}/dashboard/blogs/new`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create New Blog
            </Link>
            <Link
              href={`/${user.slug}/dashboard/settings`}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Blog Settings
            </Link>
            <Link
              href={`/${user.slug}`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              View Public Page
            </Link>
          </div>
        </div>

        {/* Blogs Overview */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Blogs</h2>
            <Link
              href={`/${user.slug}/dashboard/blogs/new`}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              + New Blog
            </Link>
          </div>
          
          {user.blogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No blogs created yet</p>
              <Link
                href={`/${user.slug}/dashboard/blogs/new`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Your First Blog
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {user.blogs.map((blog) => (
                <div key={blog.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{blog.title}</h3>
                  {blog.description && (
                    <p className="text-gray-600 text-sm mb-2">{blog.description}</p>
                  )}
                  <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
                    <span>{blog._count.posts} posts</span>
                    <span className={`px-2 py-1 rounded ${blog.isPublic ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {blog.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/${user.slug}/${blog.slug}`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View
                    </Link>
                    <Link
                      href={`/${user.slug}/dashboard/blogs/${blog.id}`}
                      className="text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}