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
  _count: {
    posts: number
  }
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [evernoteConnected, setEvernoteConnected] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user) {
      fetchBlogs()
      checkEvernoteConnection()
    }
  }, [session])

  const fetchBlogs = async () => {
    try {
      const response = await fetch('/api/blogs')
      if (response.ok) {
        const data = await response.json()
        setBlogs(data.blogs)
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
      }
    } catch (error) {
      console.error('Error connecting to Evernote:', error)
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync', { method: 'POST' })
      if (response.ok) {
        await fetchBlogs()
        alert('Sync completed successfully!')
      } else {
        alert('Sync failed. Please try again.')
      }
    } catch (error) {
      console.error('Error syncing:', error)
      alert('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
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
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">
                Welcome, {session?.user?.name || session?.user?.email}
              </span>
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
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Evernote Integration</h2>
            {evernoteConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-green-700">Connected to Evernote</span>
                </div>
                <button
                  onClick={syncNow}
                  disabled={syncing}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
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
          <h2 className="text-2xl font-bold text-gray-900">Your Blogs</h2>
          <button
            onClick={() => router.push('/dashboard/blogs/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create New Blog
          </button>
        </div>

        {blogs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 mb-4">You haven't created any blogs yet.</p>
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
                <h3 className="text-lg font-semibold mb-2">{blog.title}</h3>
                <p className="text-gray-600 mb-4">{blog.description}</p>
                <div className="text-sm text-gray-500 mb-4">
                  <p>Posts: {blog._count.posts}</p>
                  <p>Status: {blog.isPublic ? 'Public' : 'Private'}</p>
                  {blog.customDomain && <p>Domain: {blog.customDomain}</p>}
                </div>
                <div className="flex justify-between">
                  <a
                    href={`/blog/${blog.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View Blog
                  </a>
                  <button
                    onClick={() => router.push(`/dashboard/blogs/${blog.id}`)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    Settings
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