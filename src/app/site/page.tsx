'use client'

import Link from 'next/link'

export default function SitePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">FromCafe Site</h1>
              <p className="text-gray-600 mt-1">Documentation and resources</p>
            </div>
            <Link
              href="/"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/site/domains"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Custom Domain Setup</h2>
            <p className="text-gray-600">
              Learn how to connect your own domain (like yourblog.com) to your FromCafe blog.
            </p>
            <div className="mt-4 text-blue-600 font-medium">
              View instructions →
            </div>
          </Link>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Coming Soon</h2>
            <p className="text-gray-600">
              More documentation and resources will be added here.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}