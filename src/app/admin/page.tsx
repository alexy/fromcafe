'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  console.log('🎯 Admin page component loaded!')
  const { data: session, status, update } = useSession()
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [tagOperation, setTagOperation] = useState<'verify' | 'add' | null>(null)
  const [tagResults, setTagResults] = useState<{
    success: boolean
    summary: {
      totalFound: number
      evernoteCount: number
      ghostCount: number
      totalTagged?: number
      errorCount?: number
    }
    results: Array<{
      id: string
      title: string
      blog: string
      source: string
      status: string
      error?: string
    }>
    verification?: boolean
    error?: string
  } | null>(null)
  const router = useRouter()

  useEffect(() => {
    console.log('🔍 Admin page useEffect - status:', status)
    if (status === 'loading') return
    
    if (status === 'unauthenticated') {
      console.log('❌ User not authenticated, redirecting to signin')
      router.push('/auth/signin')
      return
    }
    
    // Check if already authenticated as admin via sessionStorage
    const adminAuth = sessionStorage.getItem('admin_authenticated')
    console.log('🔐 Admin auth status from sessionStorage:', adminAuth)
    
    if (adminAuth === 'true') {
      setIsAuthenticated(true)
      
      // Check if there's a return URL and redirect there
      const returnUrl = sessionStorage.getItem('admin_return_url')
      console.log('🔄 Return URL found:', returnUrl)
      
      if (returnUrl) {
        sessionStorage.removeItem('admin_return_url')
        console.log('➡️ Redirecting to return URL:', returnUrl)
        router.push(returnUrl)
        return
      }
    }
    setIsLoading(false)
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      // Promote current user to admin using the password
      const response = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        const data = await response.json()
        setIsAuthenticated(true)
        sessionStorage.setItem('admin_authenticated', 'true')
        
        // Update the session with new role information
        if (data.updateSession) {
          await update()
        }
        
        // Check if there's a return URL and redirect there
        const returnUrl = sessionStorage.getItem('admin_return_url')
        if (returnUrl) {
          sessionStorage.removeItem('admin_return_url')
          router.push(returnUrl)
          return
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Invalid password')
        setPassword('')
      }
    } catch {
      setError('Failed to authenticate')
      setPassword('')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('admin_authenticated')
    setPassword('')
    setTagResults(null)
    setTagOperation(null)
  }

  const handleVerifyTags = async () => {
    setTagOperation('verify')
    setTagResults(null)
    
    try {
      const response = await fetch('/api/admin/tag-existing-posts', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      setTagResults(data)
    } catch {
      setTagResults({ success: false, error: 'Failed to verify tags', summary: { totalFound: 0, evernoteCount: 0, ghostCount: 0 }, results: [] })
    } finally {
      setTagOperation(null)
    }
  }

  const handleAddTags = async () => {
    setTagOperation('add')
    setTagResults(null)
    
    try {
      const response = await fetch('/api/admin/tag-existing-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      setTagResults(data)
    } catch {
      setTagResults({ success: false, error: 'Failed to add tags', summary: { totalFound: 0, evernoteCount: 0, ghostCount: 0 }, results: [] })
    } finally {
      setTagOperation(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              Admin Access
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter the admin password to continue
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Admin password"
              />
            </div>
            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Access Admin Console
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Console</h1>
              {session?.user && (
                <p className="text-sm text-gray-600 mt-1">
                  Logged in as {session.user.name || session.user.email}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Admin Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Management */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      User Management
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      Manage all users
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <button
                  onClick={() => router.push('/admin/users')}
                  className="font-medium text-blue-700 hover:text-blue-900"
                >
                  View all users
                </button>
              </div>
            </div>
          </div>

          {/* Post Management */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Post Management
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      View all posts
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <button
                  onClick={() => router.push('/admin/posts')}
                  className="font-medium text-blue-700 hover:text-blue-900"
                >
                  View all posts
                </button>
              </div>
            </div>
          </div>

          {/* Tag Management */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Tag Management
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      Manage post tags
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3 space-y-2">
              <div className="flex space-x-2">
                <button
                  onClick={handleVerifyTags}
                  disabled={tagOperation === 'verify'}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {tagOperation === 'verify' ? 'Checking...' : 'Verify Tags'}
                </button>
                <button
                  onClick={handleAddTags}
                  disabled={tagOperation === 'add'}
                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
                >
                  {tagOperation === 'add' ? 'Adding...' : 'Add Tags'}
                </button>
              </div>
            </div>
          </div>

          {/* Image Naming Management */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Image Management
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      Manage image naming
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <button
                  onClick={() => router.push('/admin/image-naming')}
                  className="font-medium text-blue-700 hover:text-blue-900"
                >
                  Manage images
                </button>
              </div>
            </div>
          </div>

          {/* System Configuration */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      System Configuration
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      Configure settings
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-gray-500">
                  Coming soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              <li>
                <button
                  onClick={() => router.push('/admin/users')}
                  className="block hover:bg-gray-50 px-4 py-4 sm:px-6 w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-600 truncate">
                      Manage Users
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="text-sm text-gray-500">
                        View and manage all user accounts, roles, and permissions
                      </p>
                    </div>
                  </div>
                </button>
              </li>
              <li>
                <button
                  onClick={() => router.push('/admin/posts')}
                  className="block hover:bg-gray-50 px-4 py-4 sm:px-6 w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-600 truncate">
                      Manage Posts
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="text-sm text-gray-500">
                        View all posts in database, analyze figure structures, and clear cache
                      </p>
                    </div>
                  </div>
                </button>
              </li>
              <li>
                <button
                  onClick={() => router.push('/admin/image-naming')}
                  className="block hover:bg-gray-50 px-4 py-4 sm:px-6 w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-600 truncate">
                      Manage Images
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="text-sm text-gray-500">
                        Manage image naming decisions and review how blob names were generated
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Tag Operation Results */}
        {tagResults && (
          <div className="mt-8">
            <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Tag Operation Results
            </h2>
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                {tagResults.success ? (
                  <div>
                    <div className="mb-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {tagResults.verification ? 'Verification' : 'Tagging'} Summary
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-blue-50 p-3 rounded">
                          <dt className="text-sm font-medium text-blue-600">Total Found</dt>
                          <dd className="text-2xl font-bold text-blue-900">{tagResults.summary.totalFound}</dd>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <dt className="text-sm font-medium text-green-600">Evernote Posts</dt>
                          <dd className="text-2xl font-bold text-green-900">{tagResults.summary.evernoteCount}</dd>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                          <dt className="text-sm font-medium text-purple-600">Ghost Posts</dt>
                          <dd className="text-2xl font-bold text-purple-900">{tagResults.summary.ghostCount}</dd>
                        </div>
                      </div>
                      {!tagResults.verification && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-green-50 p-3 rounded">
                            <dt className="text-sm font-medium text-green-600">Successfully Tagged</dt>
                            <dd className="text-2xl font-bold text-green-900">{tagResults.summary.totalTagged}</dd>
                          </div>
                          {tagResults.summary.errorCount && tagResults.summary.errorCount > 0 && (
                            <div className="bg-red-50 p-3 rounded">
                              <dt className="text-sm font-medium text-red-600">Errors</dt>
                              <dd className="text-2xl font-bold text-red-900">{tagResults.summary.errorCount}</dd>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {tagResults.results && tagResults.results.length > 0 && (
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-3">
                          {tagResults.verification ? 'Posts without tags:' : 'Detailed results:'}
                        </h4>
                        <div className="max-h-96 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Post
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Blog
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Source
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {tagResults.results.map((result) => (
                                <tr key={result.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {result.title}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {result.blog}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      result.source === 'evernote' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-purple-100 text-purple-800'
                                    }`}>
                                      {result.source}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      result.status === 'success' 
                                        ? 'bg-green-100 text-green-800' 
                                        : result.status === 'error'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {result.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 p-4 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          Operation Failed
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                          {tagResults.error}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}