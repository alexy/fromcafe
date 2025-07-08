import { PostThemeProps } from '../types'
import { getBlogUrl } from '../../utils/urls'
import PostImageGallery from '../../../components/PostImageGallery'

export default function MinimalPostLayout({ blog, post, hostname }: PostThemeProps) {

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <header className="mb-12">
          <nav className="mb-8">
            <a
              href={getBlogUrl(blog.userSlug, blog.slug, hostname)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← {blog.title}
            </a>
          </nav>
          
          <time className="text-xs text-gray-500 uppercase tracking-wide">
            {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : ''}
          </time>
          
          <h1 className="text-4xl font-light text-gray-900 mt-3 leading-tight">
            {post.title}
          </h1>
          
          <p className="text-sm text-gray-500 mt-6">
            By {blog.author || blog.slug}
          </p>
        </header>

        <main>
          <article className="prose prose-lg prose-gray max-w-none">
            <div
              className="leading-relaxed"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
            <PostImageGallery postContentSelector=".prose" />
          </article>
        </main>
      </div>
    </div>
  )
}