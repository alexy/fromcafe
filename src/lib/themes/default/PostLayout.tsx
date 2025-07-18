import { PostThemeProps } from '../types'
import { getBlogUrl } from '../../utils/urls'
import PostImageGallery from '../../../components/PostImageGallery'

export default function DefaultPostLayout({ blog, post, hostname }: PostThemeProps) {

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4">
          <nav className="mb-4">
            <a
              href={getBlogUrl(blog.userSlug, blog.slug, hostname)}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              ← Back to {blog.title}
            </a>
          </nav>
          <h1 className="text-4xl font-bold mb-2">{post.title}</h1>
          <div className="text-gray-300">
            <p>By {blog.author || blog.slug}</p>
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
          <PostImageGallery postContentSelector=".prose" />
          
          {/* Post Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <a
                    key={tag.id}
                    href={`${getBlogUrl(blog.userSlug, blog.slug, hostname)}?tag=${tag.slug}`}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                  >
                    #{tag.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>
    </div>
  )
}