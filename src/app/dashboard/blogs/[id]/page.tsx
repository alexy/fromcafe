'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Blog {
  id: string
  title: string
  slug: string
  description: string
  customDomain?: string
  evernoteNotebook?: string
  isPublic: boolean
  lastSyncedAt?: string
  lastSyncAttemptAt?: string
  lastSyncUpdateCount?: number
  _count: {
    posts: number
  }
}

export default function BlogSettings() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const blogId = params.id as string
  
  const [blog, setBlog] = useState<Blog | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  
  // Track original values for change detection
  const [originalTitle, setOriginalTitle] = useState('')
  const [originalDescription, setOriginalDescription] = useState('')
  const [originalIsPublic, setOriginalIsPublic] = useState(true)
  const [notebooks, setNotebooks] = useState<Array<{guid: string, name: string}>>([])
  const [showNotebooks, setShowNotebooks] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [notebookName, setNotebookName] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<{ success: boolean; results: { blogId: string; blogTitle: string; notesFound: number; totalPublishedPosts: number; posts: { isNew: boolean; isUpdated: boolean; isUnpublished: boolean; title: string }[] }[]; totalNewPosts: number; totalUpdatedPosts: number } | null>(null)
  const [showSyncResults, setShowSyncResults] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [resettingSync, setResettingSync] = useState(false)

  const fetchBlog = useCallback(async () => {
    try {
      const response = await fetch(`/api/blogs/${blogId}`)
      if (response.ok) {
        const data = await response.json()
        setBlog(data.blog)
        setTitle(data.blog.title)
        setDescription(data.blog.description || '')
        setIsPublic(data.blog.isPublic)
        
        // Set original values for change detection
        setOriginalTitle(data.blog.title)
        setOriginalDescription(data.blog.description || '')
        setOriginalIsPublic(data.blog.isPublic)
        
        // If notebook is connected, fetch the notebook name
        if (data.blog.evernoteNotebook) {
          console.log('Blog has evernoteNotebook:', data.blog.evernoteNotebook)
          fetchNotebookName(data.blog.evernoteNotebook)
        } else {
          console.log('Blog has no evernoteNotebook')
        }
      } else {
        alert('Blog not found')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error fetching blog:', error)
      alert('Failed to load blog')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [blogId, router])

  useEffect(() => {
    // Check if we're in force auth mode (no NextAuth session required)
    const isForceAuth = sessionStorage.getItem('forceAuth') === 'true'
    
    if (!isForceAuth && status === 'unauthenticated') {
      router.push('/auth/signin')
    } else if ((isForceAuth || status === 'authenticated') && blogId) {
      fetchBlog()
    }
  }, [status, router, blogId, fetchBlog])

  const fetchNotebooks = async () => {
    try {
      const response = await fetch('/api/evernote/notebooks')
      if (response.ok) {
        const data = await response.json()
        setNotebooks(data.notebooks)
        setShowNotebooks(true)
      } else {
        alert('Failed to fetch notebooks. Please make sure you are connected to Evernote.')
      }
    } catch (error) {
      console.error('Error fetching notebooks:', error)
      alert('Failed to fetch notebooks.')
    }
  }

  const fetchNotebookName = async (notebookGuid: string) => {
    try {
      console.log('Fetching notebook name for GUID:', notebookGuid)
      const response = await fetch('/api/evernote/notebooks')
      if (response.ok) {
        const data = await response.json()
        console.log('Available notebooks:', data.notebooks)
        const notebook = data.notebooks.find((nb: { guid: string; name: string }) => nb.guid === notebookGuid)
        console.log('Found notebook:', notebook)
        if (notebook) {
          setNotebookName(notebook.name)
        } else {
          console.log('Notebook not found in list')
        }
      } else {
        console.log('Failed to fetch notebooks:', response.status)
      }
    } catch (error) {
      console.error('Error fetching notebook name:', error)
    }
  }

  const connectNotebook = async (notebookGuid: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          isPublic,
          evernoteNotebook: notebookGuid,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setBlog(data.blog)
        setShowNotebooks(false)
        // Find and set the notebook name
        const selectedNotebook = notebooks.find(nb => nb.guid === notebookGuid)
        if (selectedNotebook) {
          setNotebookName(selectedNotebook.name)
        }
        alert('Notebook connected successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to connect notebook')
      }
    } catch (error) {
      console.error('Error connecting notebook:', error)
      alert('Failed to connect notebook. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const disconnectNotebook = async () => {
    if (!confirm('Are you sure you want to disconnect this notebook? Posts will remain but won\'t sync anymore.')) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          isPublic,
          evernoteNotebook: null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setBlog(data.blog)
        setNotebookName(null)
        alert('Notebook disconnected successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to disconnect notebook')
      }
    } catch (error) {
      console.error('Error disconnecting notebook:', error)
      alert('Failed to disconnect notebook. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const resetSyncState = async () => {
    if (!confirm('Reset sync state for this blog? This will force a fresh sync on next attempt.')) {
      return
    }

    setResettingSync(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}/reset-sync`, { method: 'POST' })
      const data = await response.json()
      
      if (response.ok && data.success) {
        await fetchBlog() // Refresh blog data
        alert('Sync state reset successfully. Next sync will be a fresh full sync.')
      } else {
        alert(data.error || 'Failed to reset sync state')
      }
    } catch (error) {
      console.error('Error resetting sync state:', error)
      alert('Failed to reset sync state. Please try again.')
    } finally {
      setResettingSync(false)
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    setShowSyncResults(false)
    try {
      const response = await fetch(`/api/blogs/${blogId}/sync`, { method: 'POST' })
      const data = await response.json()
      
      if (response.ok && data.success) {
        setSyncResults({
          success: true,
          results: [{
            blogId: blogId,
            blogTitle: blog?.title || '',
            notesFound: data.result.newPosts + data.result.updatedPosts,
            totalPublishedPosts: data.result.newPosts + data.result.updatedPosts,
            posts: []
          }],
          totalNewPosts: data.result.newPosts,
          totalUpdatedPosts: data.result.updatedPosts
        })
        setShowSyncResults(true)
        // Refresh blog data to show updated post count
        fetchBlog()
      } else {
        // Handle both error responses and failed success responses
        const errorMessage = data.error || 'Unknown error'
        if (response.status === 429) {
          // Rate limit error - show specific message
          alert(`Rate limit exceeded: ${errorMessage}`)
        } else {
          alert(`Sync failed: ${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Error syncing:', error)
      alert('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  const handleSave = async () => {
    // Build object with only changed fields
    const changes: { title?: string; description?: string; isPublic?: boolean } = {}
    
    if (title !== originalTitle) {
      changes.title = title
    }
    if (description !== originalDescription) {
      changes.description = description
    }
    if (isPublic !== originalIsPublic) {
      changes.isPublic = isPublic
    }

    // Check if any changes were made
    if (Object.keys(changes).length === 0) {
      alert('No changes made.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changes),
      })

      if (response.ok) {
        const data = await response.json()
        setBlog(data.blog)
        
        // Update original values after successful save
        setOriginalTitle(title)
        setOriginalDescription(description)
        setOriginalIsPublic(isPublic)
        
        alert('Blog updated successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to update blog')
      }
    } catch (error) {
      console.error('Error updating blog:', error)
      alert('Failed to update blog. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!blog) return

    if (!confirm(`Are you sure you want to delete "${blog.title}"? This action cannot be undone and will delete all posts in this blog.`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}`, { method: 'DELETE' })
      if (response.ok) {
        alert('Blog deleted successfully!')
        router.push('/dashboard')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to delete blog')
      }
    } catch (error) {
      console.error('Error deleting blog:', error)
      alert('Failed to delete blog. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!blog) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Blog Settings</h1>
              <p className="text-black font-semibold mt-1" style={{color: '#000000'}}>{blog.title}</p>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href={`/blog/${blog.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                View Blog
              </a>
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Blog Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">General Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-black mb-2">
                  Blog Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-black mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isPublic" className="ml-2 block text-sm text-black">
                  Make this blog public
                </label>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                
                <button
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Blog'}
                </button>
              </div>
            </div>
          </div>

          {/* Blog Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Blog Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">URL</label>
                <p className="text-black">/blog/{blog.slug}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Posts</label>
                <p className="text-black">{blog._count.posts} published posts</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Status</label>
                <p className="text-black">{blog.isPublic ? 'Public' : 'Private'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Evernote Notebook</label>
                {blog.evernoteNotebook ? (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-black">Connected to {notebookName || 'Evernote notebook'}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={syncNow}
                        disabled={syncing || saving || resettingSync}
                        className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {syncing ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        onClick={resetSyncState}
                        disabled={syncing || saving || resettingSync}
                        className="bg-yellow-600 text-white px-3 py-1 text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                        title="Reset sync state to force fresh sync"
                      >
                        {resettingSync ? 'Resetting...' : 'Reset Sync'}
                      </button>
                      <button
                        onClick={disconnectNotebook}
                        disabled={saving || syncing || resettingSync}
                        className="bg-red-600 text-white px-3 py-1 text-sm rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </div>
                    <p className="text-sm text-black mt-2">
                      Syncs notes with &quot;published&quot; tag from your Evernote notebook
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="text-black">Not connected</span>
                    </div>
                    <button
                      onClick={fetchNotebooks}
                      disabled={saving}
                      className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Connect Notebook
                    </button>
                    <p className="text-sm text-black mt-2">
                      Connect an Evernote notebook to automatically sync notes as blog posts
                    </p>
                  </div>
                )}
              </div>

              {/* Sync Status */}
              {blog.evernoteNotebook && (
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Sync Status</label>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-black">Last successful sync: </span>
                      <span className="text-sm text-black font-medium">
                        {blog.lastSyncedAt ? formatTimeAgo(blog.lastSyncedAt) : 'Never'}
                      </span>
                    </div>
                    {blog.lastSyncAttemptAt && blog.lastSyncAttemptAt !== blog.lastSyncedAt && (
                      <div>
                        <span className="text-sm text-black">Last attempt: </span>
                        <span className="text-sm text-red-600 font-medium">
                          {formatTimeAgo(blog.lastSyncAttemptAt)} (failed)
                        </span>
                      </div>
                    )}
                    {blog.lastSyncUpdateCount && (
                      <div className="text-xs text-black opacity-60">
                        Sync state: {blog.lastSyncUpdateCount}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          <p>
            <strong>🎉 Blog created successfully!</strong>
          </p>
          <p className="text-sm mt-1">
            {blog.evernoteNotebook 
              ? "Your blog is now connected to your Evernote notebook and will automatically sync new posts."
              : "You can now start creating posts for your blog."
            }
          </p>
        </div>
      </main>

      {/* Notebook Selection Modal */}
      {showNotebooks && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-black">Select Notebook</h3>
                <button
                  onClick={() => setShowNotebooks(false)}
                  className="text-black hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-black mb-4">
                Choose which Evernote notebook to connect to this blog:
              </p>
              <div className="space-y-2">
                {notebooks.map((notebook) => (
                  <button
                    key={notebook.guid}
                    onClick={() => connectNotebook(notebook.guid)}
                    disabled={saving}
                    className="w-full text-left p-3 border border-gray-200 rounded hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <span className="font-medium text-black">{notebook.name}</span>
                  </button>
                ))}
              </div>
              {notebooks.length === 0 && (
                <p className="text-black text-center py-4">No notebooks found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync Results Modal */}
      {showSyncResults && syncResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-black">Sync Results</h3>
                <button
                  onClick={() => setShowSyncResults(false)}
                  className="text-black hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4">
                <h4 className="font-medium text-black mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-green-800 font-medium">New Posts</div>
                    <div className="text-green-600 text-lg">{syncResults.totalNewPosts}</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-blue-800 font-medium">Updated Posts</div>
                    <div className="text-blue-600 text-lg">{syncResults.totalUpdatedPosts}</div>
                  </div>
                </div>
              </div>

              {syncResults.results.map((result: { blogId: string; blogTitle: string; notesFound: number; totalPublishedPosts: number; posts: { isNew: boolean; isUpdated: boolean; isUnpublished: boolean; title: string }[] }) => {
                const blogResult = result.blogId === blogId ? result : null
                if (!blogResult) return null
                
                return (
                  <div key={result.blogId} className="mb-4">
                    <h4 className="font-medium text-black mb-2">{result.blogTitle}</h4>
                    <div className="text-sm text-black mb-2">
                      Found {result.notesFound} notes • {result.totalPublishedPosts} total published posts
                    </div>
                    
                    {result.posts.length > 0 && (
                      <div className="space-y-2">
                        {result.posts.map((post: { isNew: boolean; isUpdated: boolean; isUnpublished: boolean; title: string }, index: number) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            {post.isNew && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">NEW</span>}
                            {post.isUpdated && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">UPDATED</span>}
                            {post.isUnpublished && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">UNPUBLISHED</span>}
                            {post.title.startsWith('Error:') && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">ERROR</span>}
                            {post.title.startsWith('Sync failed:') && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">FAILED</span>}
                            <span className={post.title.startsWith('Error:') || post.title.startsWith('Sync failed:') ? 'text-red-600' : 'text-black'}>{post.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {result.posts.length === 0 && (
                      <div className="text-gray-500 text-sm">No changes made</div>
                    )}
                  </div>
                )
              })}
              
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => setShowSyncResults(false)}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}