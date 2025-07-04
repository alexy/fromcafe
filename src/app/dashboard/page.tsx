'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  _count: {
    posts: number
  }
}

// Helper function to determine the correct blog URL based on user preferences
function getBlogUrl(userBlogSpace: {slug: string; subdomain?: string; useSubdomain?: boolean}, blogSlug: string): string {
  if (userBlogSpace.useSubdomain && userBlogSpace.subdomain) {
    return `https://${userBlogSpace.subdomain}.from.cafe/${blogSlug}`
  }
  return `https://from.cafe/${userBlogSpace.slug}/${blogSlug}`
}

export default function Dashboard() {
  console.log('📊 Dashboard component loaded!')
  const { data: session, status } = useSession()
  const router = useRouter()
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [evernoteConnected, setEvernoteConnected] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncingBlog, setSyncingBlog] = useState<string | null>(null)
  const [resettingSync, setResettingSync] = useState(false)
  const [postEvernoteAuth, setPostEvernoteAuth] = useState(false)
  const [userBlogSpace, setUserBlogSpace] = useState<{slug: string; subdomain?: string; useSubdomain?: boolean; role?: string} | null>(null)

  useEffect(() => {
    // Check if user needs onboarding (no blog space)
    const checkBlogSpaceStatus = async () => {
      if (status === 'authenticated') {
        try {
          const response = await fetch('/api/user/blog-space')
          if (response.ok) {
            const data = await response.json()
            if (!data.user) {
              router.push('/onboarding')
              return
            } else {
              console.log('📍 Blog space data received:', data.user)
              setUserBlogSpace(data.user)
            }
          }
        } catch (error) {
          console.error('Error checking blog space status:', error)
        }
      }
    }

    // Check URL parameters for Evernote bypass mode
    const urlParams = new URLSearchParams(window.location.search)
    const evernoteBypass = urlParams.get('evernote_bypass') === 'true'
    const evernoteSuccess = urlParams.get('success') === 'evernote_connected'
    
    if (evernoteBypass) {
      console.log('Evernote bypass mode detected, using minimal NextAuth')
      setPostEvernoteAuth(true)
      
      // Try to force NextAuth session restoration without triggering Google OAuth
      const restoreSession = async () => {
        try {
          // Use manual session creation that we already have
          const response = await fetch('/api/auth/create-session', { method: 'POST' })
          const result = await response.json()
          
          if (result.success) {
            console.log('Minimal session restored for API calls')
            // Now load dashboard data with proper authentication
            setTimeout(() => {
              fetchBlogs()
              checkEvernoteConnection()
            }, 1000)
          } else {
            console.log('Session restoration failed, loading data anyway')
            fetchBlogs()
            checkEvernoteConnection()
          }
        } catch (error) {
          console.error('Session restoration error:', error)
          fetchBlogs()
          checkEvernoteConnection()
        }
      }
      
      restoreSession()
      
      if (evernoteSuccess) {
        setShowSuccess(true)
        setEvernoteConnected(true)
      }
      
      // Clean up URL immediately
      window.history.replaceState({}, document.title, '/dashboard')
      return
    }

    checkBlogSpaceStatus()
  }, [status, router])

  useEffect(() => {
    // Skip NextAuth checks if in post-OAuth state
    if (postEvernoteAuth) {
      console.log('Skipping NextAuth session check - in post-OAuth mode')
      return
    }
    
    if (status === 'unauthenticated') {
      console.log('NextAuth status unauthenticated, redirecting to signin')
      router.push('/auth/signin')
    } else if (status === 'authenticated') {
      fetchBlogs()
      checkEvernoteConnection()
      
      // Check for success/error messages from URL params
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('success') === 'evernote_connected') {
        setShowSuccess(true)
        setEvernoteConnected(true)
        // Clean up URL
        window.history.replaceState({}, document.title, '/dashboard')
      }
      if (urlParams.get('error')) {
        setShowError(urlParams.get('error') || 'Unknown error')
        // Clean up URL
        window.history.replaceState({}, document.title, '/dashboard')
      }
    }
  }, [status, router, postEvernoteAuth])

  const fetchBlogs = async () => {
    try {
      const response = await fetch('/api/blogs')
      if (response.ok) {
        const data = await response.json()
        setBlogs(data.blogs)
      } else if (response.status === 401) {
        // JWT decryption error - try to clear invalid cookies
        console.log('Authentication error, attempting to clear invalid cookies')
        try {
          const clearResponse = await fetch('/api/auth/clear-invalid-session', { method: 'POST' })
          const clearResult = await clearResponse.json()
          
          if (clearResult.clearedInvalidCookies) {
            console.log('Invalid cookies cleared, please refresh the page')
            // Show user-friendly message
            setShowError('Session expired. Please refresh the page and sign in again.')
          }
        } catch (clearError) {
          console.error('Error clearing invalid cookies:', clearError)
        }
      }
    } catch (error) {
      console.error('Error fetching blogs:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkEvernoteConnection = async () => {
    try {
      const response = await fetch('/api/user/evernote-status')
      if (response.ok) {
        const data = await response.json()
        setEvernoteConnected(data.connected)
      } else if (response.status === 401) {
        // JWT decryption error - try to clear invalid cookies
        console.log('Authentication error checking Evernote status, attempting to clear invalid cookies')
        try {
          await fetch('/api/auth/clear-invalid-session', { method: 'POST' })
        } catch (clearError) {
          console.error('Error clearing invalid cookies:', clearError)
        }
      }
    } catch (error) {
      console.error('Error checking Evernote connection:', error)
    }
  }

  const connectEvernote = async () => {
    try {
      const response = await fetch('/api/evernote/auth')
      if (response.ok) {
        const data = await response.json()
        window.location.href = data.authUrl
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to connect to Evernote')
      }
    } catch (error) {
      console.error('Error connecting to Evernote:', error)
      alert('Evernote integration is currently under development. Please check back later.')
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync', { method: 'POST' })
      const data = await response.json()
      
      if (response.ok && data.success) {
        await fetchBlogs()
        const messages = []
        if (data.totalNewPosts > 0) messages.push(`${data.totalNewPosts} new posts`)
        if (data.totalUpdatedPosts > 0) messages.push(`${data.totalUpdatedPosts} updated posts`)
        if (data.totalUnpublishedPosts > 0) messages.push(`${data.totalUnpublishedPosts} unpublished posts`)
        if (data.totalRepublishedPosts > 0) messages.push(`${data.totalRepublishedPosts} re-published posts`)
        if (data.totalRepublishedUpdatedPosts > 0) messages.push(`${data.totalRepublishedUpdatedPosts} re-published and updated posts`)
        
        const message = messages.length > 0 
          ? `Sync completed! ${messages.join(', ')}.`
          : 'Sync completed! No changes.'
        alert(message)
      } else {
        const errorMessage = data.error || 'Unknown error'
        if (response.status === 429 || errorMessage.includes('rate limit')) {
          alert(`⏱️ Rate Limited\n\n${errorMessage}\n\nThis is normal when syncing frequently. The sync will work again after the wait period.`)
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

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const syncTime = new Date(dateString)
    const diffMs = now.getTime() - syncTime.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const resetBlogSyncState = async (blogId: string) => {
    if (!confirm('Reset sync state for this blog? This will force a fresh sync on next attempt.')) {
      return
    }

    try {
      const response = await fetch(`/api/blogs/${blogId}/reset-sync`, { method: 'POST' })
      const data = await response.json()
      
      if (response.ok && data.success) {
        await fetchBlogs() // Refresh blog data
        alert('Sync state reset successfully. Next sync will be a fresh full sync.')
      } else {
        alert(data.error || 'Failed to reset sync state')
      }
    } catch (error) {
      console.error('Error resetting blog sync state:', error)
      alert('Failed to reset sync state. Please try again.')
    }
  }

  const syncBlog = async (blogId: string) => {
    setSyncingBlog(blogId)
    try {
      const response = await fetch(`/api/blogs/${blogId}/sync`, { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Wait a moment for database to fully update, then refresh blog data
          setTimeout(async () => {
            await fetchBlogs()
          }, 500)
          
          const result = data.result
          const messages = []
          if (result.newPosts > 0) messages.push(`${result.newPosts} new posts`)
          if (result.updatedPosts > 0) messages.push(`${result.updatedPosts} updated posts`)
          if (result.unpublishedPosts > 0) messages.push(`${result.unpublishedPosts} unpublished posts`)
          if (result.republishedPosts > 0) messages.push(`${result.republishedPosts} re-published posts`)
          if (result.republishedUpdatedPosts > 0) messages.push(`${result.republishedUpdatedPosts} re-published and updated posts`)
          
          const message = messages.length > 0 ? messages.join(', ') : 'No changes'
          const debugInfo = `\n\nDebug Info:\n- Total published posts: ${result.totalPublishedPosts}\n- Notes found: ${result.notesFound}`
          alert(`Sync completed! ${message}.${debugInfo}`)
        } else {
          // Update only the attempt time for failed syncs
          setBlogs(blogs.map(blog => 
            blog.id === blogId 
              ? { ...blog, lastSyncAttemptAt: new Date().toISOString() }
              : blog
          ))
          const errorMsg = data.error || 'Unknown error'
          if (errorMsg.includes('rate limit')) {
            alert(`⏱️ Rate Limited\n\n${errorMsg}\n\nThis is normal when syncing frequently. Try again after the wait period.`)
          } else {
            alert(`Sync failed: ${errorMsg}`)
          }
        }
      } else {
        // Update only the attempt time for failed syncs
        setBlogs(blogs.map(blog => 
          blog.id === blogId 
            ? { ...blog, lastSyncAttemptAt: new Date().toISOString() }
            : blog
        ))
        const errorData = await response.json()
        const errorMsg = errorData.error || 'Please try again.'
        if (errorMsg.includes('rate limit')) {
          alert(`⏱️ Rate Limited\n\n${errorMsg}\n\nThis is normal when syncing frequently. Try again after the wait period.`)
        } else {
          alert(`Sync failed: ${errorMsg}`)
        }
      }
    } catch (error) {
      // Update only the attempt time for failed syncs
      setBlogs(blogs.map(blog => 
        blog.id === blogId 
          ? { ...blog, lastSyncAttemptAt: new Date().toISOString() }
          : blog
      ))
      console.error('Error syncing blog:', error)
      alert('Sync failed. Please try again.')
    } finally {
      setSyncingBlog(null)
    }
  }

  const resetAllSyncStates = async () => {
    if (!confirm('Reset sync state for all blogs? This will force fresh syncs on next attempt.')) {
      return
    }

    setResettingSync(true)
    try {
      const response = await fetch('/api/admin/reset-all-sync-states', { method: 'POST' })
      const data = await response.json()
      
      if (response.ok && data.success) {
        await fetchBlogs() // Refresh blog data
        alert(`Reset sync state for ${data.blogsReset} blogs. Next syncs will be fresh full syncs.`)
      } else {
        alert(data.error || 'Failed to reset sync states')
      }
    } catch (error) {
      console.error('Error resetting sync states:', error)
      alert('Failed to reset sync states. Please try again.')
    } finally {
      setResettingSync(false)
    }
  }

  const disconnectEvernote = async () => {
    if (!confirm('Are you sure you want to disconnect from Evernote? You will need to reconnect to access your notebooks again.')) {
      return
    }

    setDisconnecting(true)
    try {
      const response = await fetch('/api/evernote/disconnect', { method: 'POST' })
      if (response.ok) {
        setEvernoteConnected(false)
        setShowSuccess(false)
        setShowError('')
        alert('Successfully disconnected from Evernote!')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to disconnect from Evernote')
      }
    } catch (error) {
      console.error('Error disconnecting from Evernote:', error)
      alert('Failed to disconnect from Evernote. Please try again.')
    } finally {
      setDisconnecting(false)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-black">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-black">
                  Welcome, {session?.user?.name || session?.user?.email}
                </div>
                {session?.user?.name && session?.user?.email && (
                  <div className="text-sm text-gray-600">
                    {session.user.email}
                  </div>
                )}
              </div>
              <button
                onClick={() => router.push('/dashboard/settings')}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Settings
              </button>
              {userBlogSpace?.role === 'ADMIN' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                >
                  Admin
                </button>
              )}
              <button
                onClick={() => router.push('/api/auth/signout')}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            ✓ Successfully connected to Evernote! You can now sync your notebooks.
          </div>
        )}

        {showError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            Error: {showError.replace('_', ' ')}
          </div>
        )}

        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Evernote Integration</h2>
            {evernoteConnected ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-green-700">Connected to Evernote</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {blogs.length > 0 && blogs.some(blog => blog.evernoteNotebook) && (
                      <>
                        <button
                          onClick={syncNow}
                          disabled={syncing || disconnecting || resettingSync}
                          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {syncing ? 'Syncing...' : 'Sync All Blogs'}
                        </button>
                        <button
                          onClick={resetAllSyncStates}
                          disabled={syncing || disconnecting || resettingSync}
                          className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
                          title="Reset sync state for all blogs to force fresh syncs"
                        >
                          {resettingSync ? 'Resetting...' : 'Reset Sync'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={disconnectEvernote}
                      disabled={disconnecting || syncing}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
                  <p className="text-sm">
                    <strong>Connected to Evernote!</strong> You can now connect notebooks to individual blogs from their settings pages.
                  </p>
                  <p className="text-sm mt-1">
                    To use different Evernote credentials, click Disconnect and then Connect Evernote again.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <span className="text-red-700">Not connected to Evernote</span>
                </div>
                <button
                  onClick={connectEvernote}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Connect Evernote
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-black">Your Blogs</h2>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard/blogs/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Create New Blog
            </button>
          </div>
        </div>

        {blogs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-black mb-4">You haven&apos;t created any blogs yet.</p>
            <button
              onClick={() => router.push('/dashboard/blogs/new')}
              className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
            >
              Create Your First Blog
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blogs.map((blog) => (
              <div key={blog.id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-2 text-black">{blog.title}</h3>
                <p className="text-black mb-4">{blog.description}</p>
                <div className="text-sm text-black mb-4">
                  <p>Posts: {blog._count.posts}</p>
                  <p>Status: {blog.isPublic ? 'Public' : 'Private'}</p>
                  {blog.customDomain && <p>Domain: {blog.customDomain}</p>}
                </div>
                {/* Sync Status and Actions */}
                {blog.evernoteNotebook && (
                  <div className="flex justify-between items-end border-t pt-4 mt-4">
                    <div className="text-sm">
                      <div className="text-black font-medium">Last synced</div>
                      <div className="text-black">
                        {blog.lastSyncedAt ? formatTimeAgo(blog.lastSyncedAt) : 'Never'}
                      </div>
                      {blog.lastSyncAttemptAt && blog.lastSyncAttemptAt !== blog.lastSyncedAt && (
                        <div className="text-red-600 text-xs mt-1">
                          Last attempt: {formatTimeAgo(blog.lastSyncAttemptAt)}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => syncBlog(blog.id)}
                        disabled={syncingBlog === blog.id}
                        className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {syncingBlog === blog.id ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        onClick={() => resetBlogSyncState(blog.id)}
                        disabled={syncingBlog === blog.id}
                        className="bg-yellow-600 text-white px-2 py-1 text-xs rounded hover:bg-yellow-700 disabled:opacity-50"
                        title="Reset sync state for this blog"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between mt-4">
                  {userBlogSpace ? (
                    <a
                      href={getBlogUrl(userBlogSpace, blog.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        console.log('🔗 Clicking View Blog link:', {
                          userSlug: userBlogSpace.slug,
                          blogSlug: blog.slug,
                          useSubdomain: userBlogSpace.useSubdomain,
                          url: getBlogUrl(userBlogSpace, blog.slug),
                          blogTitle: blog.title,
                          isPublic: blog.isPublic
                        })
                      }}
                    >
                      View Blog
                    </a>
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                  <button
                    onClick={() => {
                      const editUrl = postEvernoteAuth 
                        ? `/dashboard/blogs/${blog.id}?evernote_bypass=true`
                        : `/dashboard/blogs/${blog.id}`
                      router.push(editUrl)
                    }}
                    className="text-black hover:text-blue-600"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

