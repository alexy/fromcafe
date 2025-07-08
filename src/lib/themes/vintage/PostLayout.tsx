import { PostThemeProps } from '../types'
import { getBlogUrl } from '../../utils/urls'
import PostImageGallery from '../../../components/PostImageGallery'

export default function VintagePostLayout({ blog, post, hostname }: PostThemeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-yellow-50" style={{
      backgroundImage: `
        radial-gradient(circle at 25% 25%, rgba(139, 69, 19, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 75% 75%, rgba(160, 82, 45, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, rgba(101, 67, 33, 0.03) 0%, transparent 80%)
      `
    }}>
      {/* Decorative Top Border */}
      <div className="border-t-8 border-amber-800 bg-gradient-to-r from-amber-800 via-yellow-800 to-amber-800">
        <div className="h-1 bg-gradient-to-r from-transparent via-yellow-600 to-transparent"></div>
      </div>

      {/* Navigation Header */}
      <header className="bg-gradient-to-b from-amber-100 to-yellow-100 border-b-2 border-amber-700 py-6">
        <div className="max-w-4xl mx-auto px-6">
          <nav className="mb-4">
            <a
              href={getBlogUrl(blog.userSlug, blog.slug, hostname)}
              className="inline-flex items-center text-amber-800 hover:text-amber-600 font-semibold transition-colors group"
              style={{fontFamily: 'Georgia, "Times New Roman", serif'}}
            >
              <span className="mr-2 transform group-hover:-translate-x-1 transition-transform">←</span>
              <span className="border-b border-amber-800 group-hover:border-amber-600">
                Return to {blog.title}
              </span>
            </a>
          </nav>

          {/* Publication Info */}
          <div className="text-center">
            <p className="text-sm text-amber-700 uppercase tracking-widest mb-2" style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              letterSpacing: '0.15em'
            }}>
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }).toUpperCase() : ''}
            </p>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <article className="bg-gradient-to-b from-yellow-50 to-amber-50 border-4 border-amber-800 border-double shadow-2xl relative">
          {/* Ornate Corner Decorations */}
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-amber-800 rotate-45"></div>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-800 rotate-45"></div>
          <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-amber-800 rotate-45"></div>
          <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-amber-800 rotate-45"></div>

          {/* Article Header */}
          <header className="p-8 pb-6 border-b-2 border-amber-700 border-dotted">
            {/* Decorative Top Flourish */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-12 h-0.5 bg-amber-800"></div>
                <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                <div className="w-4 h-4 border-2 border-amber-800 rotate-45"></div>
                <div className="w-6 h-6 border-2 border-amber-800 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                </div>
                <div className="w-4 h-4 border-2 border-amber-800 rotate-45"></div>
                <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                <div className="w-12 h-0.5 bg-amber-800"></div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-amber-900 leading-tight text-center mb-6" style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow: '2px 2px 4px rgba(139, 69, 19, 0.2)',
              letterSpacing: '0.02em',
              lineHeight: '1.2'
            }}>
              {post.title}
            </h1>

            {/* Author and Date Info */}
            <div className="text-center">
              {/* Decorative Divider */}
              <div className="flex justify-center mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-0.5 bg-amber-700"></div>
                  <div className="w-2 h-2 bg-amber-700 rounded-full"></div>
                  <div className="w-3 h-3 border border-amber-700 rotate-45"></div>
                  <div className="w-2 h-2 bg-amber-700 rounded-full"></div>
                  <div className="w-8 h-0.5 bg-amber-700"></div>
                </div>
              </div>

              <div className="flex justify-center items-center space-x-4 text-amber-700">
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    letterSpacing: '0.1em'
                  }}>
                    BY
                  </p>
                  <p className="text-lg font-bold" style={{fontFamily: 'Georgia, "Times New Roman", serif'}}>
                    {blog.author || blog.slug}
                  </p>
                </div>
                
                <div className="w-px h-12 bg-amber-700"></div>
                
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    letterSpacing: '0.1em'
                  }}>
                    PUBLISHED
                  </p>
                  <time className="text-lg font-bold" style={{fontFamily: 'Georgia, "Times New Roman", serif'}}>
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }).toUpperCase() : ''}
                  </time>
                </div>
              </div>
            </div>

            {/* Bottom Flourish */}
            <div className="flex justify-center mt-6">
              <div className="flex items-center space-x-2">
                <div className="w-12 h-0.5 bg-amber-800"></div>
                <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                <div className="w-4 h-4 border-2 border-amber-800 rotate-45"></div>
                <div className="w-6 h-6 border-2 border-amber-800 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                </div>
                <div className="w-4 h-4 border-2 border-amber-800 rotate-45"></div>
                <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                <div className="w-12 h-0.5 bg-amber-800"></div>
              </div>
            </div>
          </header>

          {/* Article Body */}
          <div className="p-8">
            {/* Drop Cap and Content */}
            <div 
              className="vintage-prose prose prose-lg max-w-none text-amber-900 leading-relaxed"
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                lineHeight: '1.8',
                textAlign: 'justify',
                columnCount: 2,
                columnGap: '3rem',
                columnRule: '2px dotted #92400e', // amber-800
                columnFill: 'balance',
                orphans: 3,
                widows: 3,
              }}
            >
              <style>{`
                .vintage-prose p:first-of-type::first-letter {
                  float: left;
                  font-size: 4rem;
                  line-height: 3rem;
                  padding-right: 0.5rem;
                  padding-top: 0.25rem;
                  font-weight: bold;
                  color: #92400e;
                  font-family: Georgia, "Times New Roman", serif;
                  text-shadow: 2px 2px 4px rgba(139, 69, 19, 0.2);
                }
                
                .vintage-prose h1, .vintage-prose h2, .vintage-prose h3, .vintage-prose h4, .vintage-prose h5, .vintage-prose h6 {
                  font-family: Georgia, "Times New Roman", serif;
                  color: #92400e;
                  font-weight: bold;
                  margin-top: 2rem;
                  margin-bottom: 1rem;
                  text-align: center;
                  break-after: avoid;
                }
                
                .vintage-prose h2 {
                  font-size: 1.5rem;
                  border-bottom: 2px dotted #92400e;
                  padding-bottom: 0.5rem;
                }
                
                .vintage-prose h3 {
                  font-size: 1.25rem;
                }
                
                .vintage-prose blockquote {
                  border-left: 4px solid #92400e;
                  background: #fef3c7;
                  padding: 1rem;
                  margin: 1.5rem 0;
                  font-style: italic;
                  border-radius: 0;
                  break-inside: avoid;
                }
                
                .vintage-prose ul, .vintage-prose ol {
                  break-inside: avoid;
                }
                
                .vintage-prose p img {
                  margin: 1.5rem auto;
                }
                
                .vintage-prose p:only-child img {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                  -webkit-column-break-inside: avoid !important;
                  column-break-inside: avoid !important;
                }
                
                .vintage-prose div img, .vintage-prose figure {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                  -webkit-column-break-inside: avoid !important;
                  column-break-inside: avoid !important;
                }
                
                .vintage-prose img {
                  border: 3px solid #92400e;
                  border-radius: 4px;
                  box-shadow: 4px 4px 8px rgba(139, 69, 19, 0.3);
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                  -webkit-column-break-inside: avoid !important;
                  column-break-inside: avoid !important;
                  margin: 1.5rem auto;
                  max-width: 100%;
                  height: auto;
                  display: block;
                  max-height: 60vh;
                  width: auto;
                  box-sizing: border-box;
                  column-span: all;
                }
                
                @media (max-width: 768px) {
                  .vintage-prose {
                    column-count: 1 !important;
                  }
                }
              `}</style>
              
              <div dangerouslySetInnerHTML={{ __html: post.content }} />
            </div>
            <PostImageGallery postContentSelector=".vintage-prose" />
          </div>

          {/* Vignette Effects */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-radial from-transparent via-transparent to-amber-900/10"></div>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-amber-900/8 via-transparent to-amber-900/8"></div>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-amber-900/8 via-transparent to-amber-900/8"></div>
        </article>

        {/* Article Footer */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-amber-800 text-yellow-50 px-6 py-2" style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            letterSpacing: '0.15em'
          }}>
            <span className="text-sm font-bold">~ END OF ARTICLE ~</span>
          </div>
        </div>
      </main>

      {/* Decorative Footer */}
      <footer className="border-t-4 border-amber-800 bg-gradient-to-b from-amber-100 to-yellow-100 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-16 h-0.5 bg-amber-800"></div>
              <div className="w-3 h-3 bg-amber-800 rounded-full"></div>
              <div className="w-6 h-6 border-2 border-amber-800 rotate-45"></div>
              <div className="w-3 h-3 bg-amber-800 rounded-full"></div>
              <div className="w-16 h-0.5 bg-amber-800"></div>
            </div>
          </div>
          <a
            href={getBlogUrl(blog.userSlug, blog.slug, hostname)}
            className="text-amber-700 hover:text-amber-600 text-sm transition-colors border-b border-amber-700 hover:border-amber-600"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              letterSpacing: '0.1em'
            }}
          >
            ~ Return to Publication Index ~
          </a>
        </div>
      </footer>
    </div>
  )
}