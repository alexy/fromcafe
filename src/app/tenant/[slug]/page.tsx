import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import Link from 'next/link'

interface TenantPageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
    include: { blogs: true }
  })

  if (!tenant) {
    return { title: 'Tenant Not Found' }
  }

  return {
    title: `${tenant.name} - FromCafe`,
    description: `${tenant.name} blogs on FromCafe platform`
  }
}

export default async function TenantPage({ params }: TenantPageProps) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
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

  if (!tenant || !tenant.isActive) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{tenant.name}</h1>
        <p className="text-gray-600">
          Welcome to {tenant.name}'s collection of blogs on FromCafe
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {tenant.blogs.map((blog) => (
          <div key={blog.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">
              <Link 
                href={`/tenant/${tenant.slug}/blog/${blog.slug}`}
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
                        href={`/tenant/${tenant.slug}/blog/${blog.slug}/${post.slug}`}
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

      {tenant.blogs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No public blogs available for this tenant.</p>
        </div>
      )}
    </div>
  )
}