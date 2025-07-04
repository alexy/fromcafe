import { BlogThemeProps } from '../types'
import { getPostUrl } from '../../utils/urls'

export default function ModernBlogLayout({ blog, posts, hostname }: BlogThemeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="text-center mb-16">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              {blog.title}
            </h1>
            {blog.description && (
              <p className="text-lg text-gray-600">{blog.description}</p>
            )}
            <div className="flex items-center justify-center mt-6">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {blog.title.charAt(0).toUpperCase()}
              </div>
              <p className="text-gray-700 ml-3 font-medium">
                {blog.author || blog.title}
              </p>
            </div>
          </div>
        </header>

        <main>
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
                <p className="text-gray-600 text-lg">No posts published yet.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              {posts.map((post) => (
                <article key={post.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                  <header className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <time className="text-sm text-blue-600 font-medium">
                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : ''}
                      </time>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      <a
                        href={getPostUrl(blog.userSlug, blog.slug, post.slug, hostname)}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {post.title}
                      </a>
                    </h2>
                  </header>
                  {post.excerpt && (
                    <div className="text-gray-600 leading-relaxed mb-4">
                      <p>{post.excerpt}</p>
                    </div>
                  )}
                  <footer>
                    <a
                      href={getPostUrl(blog.userSlug, blog.slug, post.slug, hostname)}
                      className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                    >
                      Read full post
                      <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}