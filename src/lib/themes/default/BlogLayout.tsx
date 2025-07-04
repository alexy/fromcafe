import { BlogThemeProps } from '../types'
import { getPostUrl } from '../../utils/urls'

export default function DefaultBlogLayout({ blog, posts, hostname }: BlogThemeProps) {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">{blog.title}</h1>
          {blog.description && (
            <p className="text-xl text-white">{blog.description}</p>
          )}
          <p className="text-sm text-gray-200 mt-4">
            From the {blog.title} blog by {blog.author || blog.slug}
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-black text-lg">No posts published yet.</p>
          </div>
        ) : (
          <div className="grid gap-8">
            {posts.map((post) => (
              <article key={post.id} className="border-b pb-8">
                <header className="mb-4">
                  <h2 className="text-2xl font-bold mb-2">
                    <a
                      href={getPostUrl(blog.userSlug, blog.slug, post.slug, hostname)}
                      className="text-black hover:text-blue-600 transition-colors"
                    >
                      {post.title}
                    </a>
                  </h2>
                  <time className="text-black text-sm">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
                  </time>
                </header>
                <div className="prose max-w-none">
                  {post.excerpt && <p className="text-black">{post.excerpt}</p>}
                </div>
                <footer className="mt-4">
                  <a
                    href={getPostUrl(blog.userSlug, blog.slug, post.slug, hostname)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Read more →
                  </a>
                </footer>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}