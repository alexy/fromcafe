'use client'

import { useState, useEffect } from 'react'

interface Post {
  id: string
  title: string
  slug: string
  blog: {
    slug: string
    title: string
    subdomain: string | null
    customDomain: string | null
    userSlug: string | null
  }
  url: string
  isPublished: boolean
  contentFormat: string
  contentLength: number
  figureCount: number
  figcaptionCount: number
  hasNestedFigures: boolean
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  content?: string
  excerpt?: string | null
}

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blogFilter, setBlogFilter] = useState('')
  const [showContent, setShowContent] = useState(false)
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, hasMore: false })

  const fetchPosts = async (blog = '', offset = 0, content = false) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: '20',
        offset: offset.toString(),
        content: content.toString()
      })
      
      if (blog) {
        params.append('blog', blog)
      }

      const response = await fetch(`/api/admin/posts?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch posts')
      }

      const data = await response.json()
      setPosts(data.posts)
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const clearCache = async (postId: string) => {
    try {
      const response = await fetch('/api/admin/posts?action=clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      })

      if (!response.ok) {
        throw new Error('Failed to clear cache')
      }

      alert('Cache cleared for post')
    } catch (err) {
      alert('Failed to clear cache: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  useEffect(() => {
    fetchPosts(blogFilter, 0, showContent)
  }, [blogFilter, showContent])

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBlogFilter(e.target.value)
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const loadMore = () => {
    const newOffset = pagination.offset + pagination.limit
    fetchPosts(blogFilter, newOffset, showContent)
  }

  if (loading && posts.length === 0) {
    return <div className="p-8">Loading...</div>
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin: Posts Database</h1>
      
      <div className="mb-6 flex gap-4 items-center">
        <input
          type="text"
          placeholder="Filter by blog slug..."
          value={blogFilter}
          onChange={handleFilterChange}
          className="px-3 py-2 border rounded"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showContent}
            onChange={(e) => setShowContent(e.target.checked)}
          />
          Show content
        </label>
        <span className="text-sm text-black">
          {pagination.total} posts total
        </span>
      </div>

      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-lg">{post.title}</h3>
                <p className="text-sm text-black">
                  {post.blog.title} ({post.blog.slug})
                  {post.blog.subdomain && ` - ${post.blog.subdomain}.from.cafe`}
                  {post.blog.customDomain && ` - ${post.blog.customDomain}`}
                </p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 rounded text-xs ${
                  post.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {post.isPublished ? 'Published' : 'Draft'}
                </span>
                <button
                  onClick={() => clearCache(post.id)}
                  className="ml-2 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  Clear Cache
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2">
              <div>
                <span className="font-medium">Slug:</span> {post.slug}
              </div>
              <div>
                <span className="font-medium">Format:</span> {post.contentFormat}
              </div>
              <div>
                <span className="font-medium">Length:</span> {post.contentLength.toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Figures:</span> {post.figureCount}
                {post.hasNestedFigures && <span className="text-red-600 ml-1">⚠️ Nested</span>}
              </div>
            </div>

            <div className="text-xs text-black mb-2">
              <span>Created: {new Date(post.createdAt).toLocaleString()}</span>
              <span className="ml-4">Updated: {new Date(post.updatedAt).toLocaleString()}</span>
              {post.publishedAt && (
                <span className="ml-4">Published: {new Date(post.publishedAt).toLocaleString()}</span>
              )}
            </div>

            <div className="mb-2">
              <a 
                href={post.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                {post.url}
              </a>
            </div>

            {showContent && post.content && (
              <div className="mt-4 border-t pt-4">
                <h4 className="font-medium mb-2">Content:</h4>
                <div className="text-sm bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-xs text-black">
                    {post.content.substring(0, 2000)}
                    {post.content.length > 2000 && '... (truncated)'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {pagination.hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}