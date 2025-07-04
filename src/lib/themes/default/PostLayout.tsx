import { PostThemeProps } from '../types'
import { getBlogUrl } from '../../utils/urls'

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
            <p>By {blog.title}</p>
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