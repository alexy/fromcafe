import { BlogThemeProps } from '../types'

export default function VintageBlogLayout({ blog, posts }: BlogThemeProps) {
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

      {/* Vintage Header */}
      <header className="bg-gradient-to-b from-amber-100 to-yellow-100 border-b-4 border-amber-800 relative">
        {/* Ornamental Top Border */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-700 via-yellow-700 to-amber-700"></div>
        <div className="absolute top-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-900 to-transparent"></div>
        
        <div className="max-w-6xl mx-auto px-6 py-12 text-center relative">
          {/* Decorative Corner Elements */}
          <div className="absolute top-8 left-8 w-16 h-16 border-4 border-amber-800 rounded-full opacity-20"></div>
          <div className="absolute top-8 right-8 w-16 h-16 border-4 border-amber-800 rounded-full opacity-20"></div>
          <div className="absolute bottom-8 left-8 w-12 h-12 border-2 border-amber-700 rotate-45 opacity-15"></div>
          <div className="absolute bottom-8 right-8 w-12 h-12 border-2 border-amber-700 rotate-45 opacity-15"></div>

          {/* Ornate Header Border */}
          <div className="border-4 border-amber-800 border-double p-8 bg-gradient-to-b from-yellow-50 to-amber-50 shadow-inner">
            {/* Decorative Top Flourish */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-0.5 bg-amber-800"></div>
                <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                <div className="w-4 h-4 border-2 border-amber-800 rotate-45"></div>
                <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                <div className="w-8 h-0.5 bg-amber-800"></div>
              </div>
            </div>

            <h1 className="text-5xl font-bold text-amber-900 mb-2" style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow: '2px 2px 4px rgba(139, 69, 19, 0.2)',
              letterSpacing: '0.05em'
            }}>
              {blog.title}
            </h1>
            
            {/* Decorative Divider */}
            <div className="flex justify-center my-4">
              <div className="flex items-center space-x-1">
                <div className="w-6 h-0.5 bg-amber-700"></div>
                <div className="w-1.5 h-1.5 bg-amber-700 rounded-full"></div>
                <div className="w-3 h-3 border border-amber-700 rotate-45"></div>
                <div className="w-1.5 h-1.5 bg-amber-700 rounded-full"></div>
                <div className="w-6 h-0.5 bg-amber-700"></div>
              </div>
            </div>

            {blog.description && (
              <p className="text-xl text-amber-800 italic leading-relaxed" style={{
                fontFamily: 'Georgia, "Times New Roman", serif'
              }}>
                &ldquo;{blog.description}&rdquo;
              </p>
            )}
            
            {/* Publication Info */}
            <div className="mt-6 pt-4 border-t-2 border-amber-700 border-dotted">
              <p className="text-sm text-amber-700 uppercase tracking-widest" style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                letterSpacing: '0.1em'
              }}>
                Published by {blog.user.name || blog.user.email}
              </p>
            </div>

            {/* Bottom Flourish */}
            <div className="flex justify-center mt-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-0.5 bg-amber-800"></div>
                <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                <div className="w-4 h-4 border-2 border-amber-800 rotate-45"></div>
                <div className="w-2 h-2 bg-amber-800 rounded-full"></div>
                <div className="w-8 h-0.5 bg-amber-800"></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="border-4 border-amber-800 border-double p-12 bg-gradient-to-b from-yellow-50 to-amber-50">
              <p className="text-amber-800 text-lg" style={{fontFamily: 'Georgia, "Times New Roman", serif'}}>
                No articles have been published yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {posts.map((post) => (
              <article key={post.id} className="break-inside-avoid mb-8">
                {/* Article Container with Vintage Border */}
                <div className="border-2 border-amber-800 bg-gradient-to-b from-yellow-50 to-amber-50 shadow-lg relative">
                  {/* Corner Decorations */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 bg-amber-800"></div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-800"></div>
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-amber-800"></div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-800"></div>

                  <div className="p-6">
                    {/* Date Badge in top position */}
                    <div className="absolute -top-3 left-6 bg-amber-800 text-yellow-50 px-3 py-1 text-xs font-bold" style={{
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      letterSpacing: '0.1em'
                    }}>
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }).toUpperCase() : 'UNPUBLISHED'}
                    </div>

                    <header className="mb-4 pt-2">
                      
                      <h2 className="text-2xl font-bold text-amber-900 leading-tight mb-3" style={{
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        textShadow: '1px 1px 2px rgba(139, 69, 19, 0.1)'
                      }}>
                        <a
                          href={`/blog/${blog.slug}/${post.slug}`}
                          className="hover:text-amber-700 transition-colors decoration-2 underline-offset-4 hover:underline"
                        >
                          {post.title}
                        </a>
                      </h2>

                      {/* Decorative Divider */}
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-amber-700 to-transparent"></div>
                        <div className="w-2 h-2 bg-amber-700 rotate-45"></div>
                        <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-amber-700 to-transparent"></div>
                      </div>
                    </header>

                    {post.excerpt && (
                      <div className="mb-4">
                        <p className="text-amber-800 leading-relaxed text-justify" style={{
                          fontFamily: 'Georgia, "Times New Roman", serif',
                          textIndent: '1.5em',
                          lineHeight: '1.8'
                        }}>
                          {post.excerpt}
                        </p>
                      </div>
                    )}

                    <footer className="pt-4 border-t border-amber-300 border-dotted">
                      <a
                        href={`/blog/${blog.slug}/${post.slug}`}
                        className="inline-flex items-center text-amber-800 hover:text-amber-600 font-semibold text-sm transition-colors group"
                        style={{fontFamily: 'Georgia, "Times New Roman", serif'}}
                      >
                        <span className="border-b border-amber-800 group-hover:border-amber-600">
                          Continue Reading
                        </span>
                        <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                      </a>
                    </footer>
                  </div>

                  {/* Vignette Effect */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-amber-900/5 via-transparent to-amber-900/5"></div>
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-amber-900/5 via-transparent to-amber-900/5"></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Decorative Footer */}
      <footer className="border-t-4 border-amber-800 bg-gradient-to-b from-amber-100 to-yellow-100 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-12 h-0.5 bg-amber-800"></div>
              <div className="w-3 h-3 bg-amber-800 rounded-full"></div>
              <div className="w-6 h-6 border-2 border-amber-800 rotate-45"></div>
              <div className="w-3 h-3 bg-amber-800 rounded-full"></div>
              <div className="w-12 h-0.5 bg-amber-800"></div>
            </div>
          </div>
          <p className="text-amber-700 text-sm" style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            letterSpacing: '0.1em'
          }}>
            ~ End of Publication ~
          </p>
        </div>
      </footer>
    </div>
  )
}