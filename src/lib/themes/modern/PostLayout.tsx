import { PostThemeProps } from '../types'
import { getBlogUrl } from '../../utils/urls'
import PostImageGallery from '../../../components/PostImageGallery'

export default function ModernPostLayout({ blog, post, hostname }: PostThemeProps) {

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <nav className="mb-8">
          <a
            href={getBlogUrl(blog.userSlug, blog.slug, hostname)}
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to {blog.title}
          </a>
        </nav>

        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <header className="p-8 border-b border-gray-100">
            <time className="text-sm text-blue-600 font-medium">
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : ''}
            </time>
            
            <h1 className="text-3xl font-bold text-gray-900 mt-3 leading-tight">
              {post.title}
            </h1>
            
            <div className="flex items-center mt-6">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {blog.title.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3">
                <p className="text-gray-700 font-medium">
                  {blog.title}
                </p>
              </div>
            </div>
          </header>

          <main className="p-8">
            <div
              className="prose prose-lg prose-blue max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
            <PostImageGallery postContentSelector=".prose" />
            
            {/* Post Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <a
                      key={tag.id}
                      href={`${getBlogUrl(blog.userSlug, blog.slug, hostname)}?tag=${tag.slug}`}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 hover:from-blue-100 hover:to-purple-100 transition-colors"
                    >
                      #{tag.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </main>
        </article>
      </div>
    </div>
  )
}