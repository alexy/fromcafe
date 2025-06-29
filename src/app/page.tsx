import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Evernote Blog
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transform your Evernote notes into beautiful, professional blogs. 
            Connect your notebooks, tag posts as &quot;published&quot;, and watch your content come to life.
          </p>
        </header>

        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-xl font-semibold mb-2">Write in Evernote</h3>
              <p className="text-gray-600">
                Use the note-taking app you already love. Write, format, and organize your thoughts naturally.
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-4xl mb-4">🏷️</div>
              <h3 className="text-xl font-semibold mb-2">Tag to Publish</h3>
              <p className="text-gray-600">
                Simply add a &quot;published&quot; tag to any note to make it live on your blog. Remove the tag to unpublish.
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-semibold mb-2">Beautiful Blogs</h3>
              <p className="text-gray-600">
                Your notes automatically become beautiful blog posts with custom domains and themes.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/dashboard"
              className="inline-block bg-blue-600 text-white text-lg font-semibold px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              Get Started
            </Link>
            <p className="text-sm text-gray-500 mt-4">
              Sign in with Google to create your first blog
            </p>
          </div>
        </div>

        <footer className="text-center mt-16 pt-8 border-t border-gray-200">
          <p className="text-gray-500">
            Built with Next.js, TypeScript, and PostgreSQL
          </p>
        </footer>
      </div>
    </div>
  )
}
