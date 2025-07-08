import { BlogThemeProps } from '../types'
import { getPostUrl, getBlogUrl } from '../../utils/urls'

export default function MinimalBlogLayout({ blog, posts, hostname, currentTag }: BlogThemeProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-light text-gray-900 mb-4">{blog.title}</h1>
          {blog.description && (
            <p className="text-lg text-gray-600 font-light">{blog.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-6">
            {blog.title}
          </p>
        </header>

        <main>
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-600 text-lg font-light">No posts yet.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {posts.map((post) => (
                <article key={post.id} className="pb-8 border-b border-gray-200 last:border-b-0">
                  <header className="mb-6">
                    <time className="text-xs text-gray-500 uppercase tracking-wide">
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : ''}
                    </time>
                    <h2 className="text-2xl font-light text-gray-900 mt-2 leading-tight">
                      <a
                        href={getPostUrl(blog.userSlug, blog.slug, post.slug, hostname)}
                        className="hover:text-gray-600 transition-colors"
                      >
                        {post.title}
                      </a>
                    </h2>
                  </header>
                  {post.excerpt && (
                    <div className="text-gray-700 leading-relaxed mb-4">
                      <p>{post.excerpt}</p>
                    </div>
                  )}
                  <footer>
                    <a
                      href={getPostUrl(blog.userSlug, blog.slug, post.slug, hostname)}
                      className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                    >
                      Continue reading →
                    </a>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </main>
        
        {/* Tag Filter Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">Filter by tag:</p>
            <div className="flex justify-center gap-3">
              <a
                href={getBlogUrl(blog.userSlug, blog.slug, hostname)}
                className={`px-4 py-2 text-sm font-light transition-colors ${
                  !currentTag || currentTag === 'all' 
                    ? 'text-gray-900 border-b-2 border-gray-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                all
              </a>
              <a
                href={`${getBlogUrl(blog.userSlug, blog.slug, hostname)}?tag=evernote`}
                className={`px-4 py-2 text-sm font-light transition-colors ${
                  currentTag === 'evernote' 
                    ? 'text-gray-900 border-b-2 border-gray-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                evernote
              </a>
              <a
                href={`${getBlogUrl(blog.userSlug, blog.slug, hostname)}?tag=ghost`}
                className={`px-4 py-2 text-sm font-light transition-colors ${
                  currentTag === 'ghost' 
                    ? 'text-gray-900 border-b-2 border-gray-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                ghost
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}