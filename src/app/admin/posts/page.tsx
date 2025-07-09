'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Post {
  id: string
  title: string
  slug: string
  blog: {
    id: string
    slug: string
    title: string
    subdomain: string | null
    customDomain: string | null
    userSlug: string | null
  }
  url: string
  isPublished: boolean
  contentSource: string
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
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blogFilter, setBlogFilter] = useState('')
  const [showContent, setShowContent] = useState(false)
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'unpublished'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'EVERNOTE' | 'GHOST'>('all')
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, hasMore: false, page: 1, totalPages: 1 })

  const fetchPosts = useCallback(async (blog = '', page = 1, content = false, published = publishedFilter, source = sourceFilter) => {
    try {
      setLoading(true)
      const offset = (page - 1) * 20
      const params = new URLSearchParams({
        limit: '20',
        offset: offset.toString(),
        content: content.toString()
      })
      
      if (blog) {
        params.append('blog', blog)
      }

      if (published !== 'all') {
        params.append('published', published === 'published' ? 'true' : 'false')
      }

      if (source !== 'all') {
        params.append('source', source)
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
  }, [publishedFilter, sourceFilter])

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

  const fixNestedFigures = async (postId: string) => {
    try {
      const response = await fetch('/api/admin/fix-nested-figures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      })

      if (!response.ok) {
        throw new Error('Failed to fix nested figures')
      }

      const result = await response.json()
      alert(result.message)
      
      // Refresh the posts list to show updated content
      if (result.figuresFixed > 0) {
        fetchPosts(blogFilter, pagination.page, showContent, publishedFilter, sourceFilter)
      }
    } catch (err) {
      alert('Failed to fix nested figures: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const updateCaptions = async (blogId: string, blogTitle: string) => {
    // This function is no longer needed since we now use dynamic caption rendering
    console.log('Update captions called for blog:', blogId, blogTitle)
    alert('Dynamic caption rendering is now enabled. Captions will update automatically based on blog settings.')
  }

  const deleteUnpublishedPost = async (postId: string, postTitle: string) => {
    if (!confirm(`Are you sure you want to delete the unpublished post "${postTitle}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/admin/posts?action=delete-unpublished', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      })

      if (!response.ok) {
        throw new Error('Failed to delete post')
      }

      const result = await response.json()
      alert(result.message)
      
      // Refresh the posts list
      fetchPosts(blogFilter, pagination.page, showContent, publishedFilter, sourceFilter)
    } catch (err) {
      alert('Failed to delete post: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  useEffect(() => {
    fetchPosts(blogFilter, 1, showContent, publishedFilter, sourceFilter)
  }, [blogFilter, showContent, publishedFilter, sourceFilter, fetchPosts])

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBlogFilter(e.target.value)
    setPagination(prev => ({ ...prev, page: 1, offset: 0 }))
  }

  const goToPage = (page: number) => {
    fetchPosts(blogFilter, page, showContent, publishedFilter, sourceFilter)
  }

  if (loading && posts.length === 0) {
    return <div className="p-8">Loading...</div>
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-900">Admin: Posts Database</h1>
        <button
          onClick={() => router.push('/admin')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          ← Back to Admin
        </button>
      </div>
      
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
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
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Published:</label>
            <select
              value={publishedFilter}
              onChange={(e) => setPublishedFilter(e.target.value as 'all' | 'published' | 'unpublished')}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Source:</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | 'EVERNOTE' | 'GHOST')}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="all">All</option>
              <option value="EVERNOTE">Evernote</option>
              <option value="GHOST">Ghost</option>
            </select>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          <strong>Caption Update:</strong> Updates existing image captions to respect current blog showCameraMake setting
        </div>
      </div>

      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-lg text-blue-900">{post.title}</h3>
                <p className="text-sm text-black">
                  {post.blog.title} ({post.blog.slug})
                  {post.blog.subdomain && ` - ${post.blog.subdomain}.from.cafe`}
                  {post.blog.customDomain && ` - ${post.blog.customDomain}`}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    post.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {post.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    post.contentSource === 'EVERNOTE' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {post.contentSource}
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-end flex-wrap">
                  <button
                    onClick={() => clearCache(post.id)}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                  >
                    Clear Cache
                  </button>
                  {post.hasNestedFigures && (
                    <button
                      onClick={() => fixNestedFigures(post.id)}
                      className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                    >
                      Fix Nested Figures
                    </button>
                  )}
                  {post.figcaptionCount > 0 && (
                    <button
                      onClick={() => updateCaptions(post.blog.id, post.blog.title)}
                      className="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600"
                    >
                      Update Captions
                    </button>
                  )}
                  {!post.isPublished && (
                    <button
                      onClick={() => deleteUnpublishedPost(post.id, post.title)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
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
              <div>
                <span className="font-medium">Captions:</span> {post.figcaptionCount}
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
                <h4 className="font-medium mb-2 text-blue-900">Content:</h4>
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

      {pagination.totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-4">
          <button
            onClick={() => goToPage(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-2">
            {/* Show first page */}
            {pagination.page > 3 && (
              <>
                <button
                  onClick={() => goToPage(1)}
                  className="px-3 py-2 border rounded hover:bg-gray-100"
                >
                  1
                </button>
                {pagination.page > 4 && <span className="px-2">...</span>}
              </>
            )}
            
            {/* Show pages around current page */}
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const startPage = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4))
              const pageNum = startPage + i
              
              if (pageNum > pagination.totalPages) return null
              
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`px-3 py-2 border rounded hover:bg-gray-100 ${
                    pageNum === pagination.page ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            
            {/* Show last page */}
            {pagination.page < pagination.totalPages - 2 && (
              <>
                {pagination.page < pagination.totalPages - 3 && <span className="px-2">...</span>}
                <button
                  onClick={() => goToPage(pagination.totalPages)}
                  className="px-3 py-2 border rounded hover:bg-gray-100"
                >
                  {pagination.totalPages}
                </button>
              </>
            )}
          </div>
          
          <button
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
      
      <div className="mt-4 text-center text-sm text-gray-600">
        Page {pagination.page} of {pagination.totalPages} • {pagination.total} posts total
      </div>
    </div>
  )
}