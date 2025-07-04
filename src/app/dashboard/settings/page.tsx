'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UserBlogSpace {
  id: string
  displayName: string | null
  slug: string
  subdomain: string | null
  domain: string | null
  useSubdomain: boolean
  isActive: boolean
  role?: string
}

export default function UserSettings() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userBlogSpace, setUserBlogSpace] = useState<UserBlogSpace | null>(null)
  
  const [displayName, setDisplayName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [domain, setDomain] = useState('')
  const [useSubdomain, setUseSubdomain] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchUserBlogSpace = useCallback(async () => {
    try {
      const response = await fetch('/api/user/blog-space')
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setUserBlogSpace(data.user)
          setDisplayName(data.user.displayName || '')
          // If no subdomain is set, use the user's slug as default
          setSubdomain(data.user.subdomain || data.user.slug || '')
          setDomain(data.user.domain || '')
          setUseSubdomain(data.user.useSubdomain || false)
        }
      }
    } catch (error) {
      console.error('Error fetching user blog space:', error)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    } else if (status === 'authenticated') {
      fetchUserBlogSpace()
    }
  }, [status, router, fetchUserBlogSpace])

  const handleSave = async () => {
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const response = await fetch('/api/user/blog-space', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: displayName,
          subdomain: subdomain || null,
          domain: domain || null,
          useSubdomain
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setUserBlogSpace(data.user)
        setSuccess('Settings updated successfully!')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to update settings')
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      setError('Failed to update settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getExampleUrls = () => {
    if (!userBlogSpace) return { path: '', subdomain: '' }
    
    const pathUrl = `https://from.cafe/${userBlogSpace.slug}/blog-name`
    const subdomainUrl = subdomain 
      ? `https://${subdomain}.from.cafe/blog-name`
      : `https://${userBlogSpace.slug}.from.cafe/blog-name`
    
    return { path: pathUrl, subdomain: subdomainUrl }
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

  if (!userBlogSpace) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No blog space found.</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create Blog Space
          </button>
        </div>
      </div>
    )
  }

  const exampleUrls = getExampleUrls()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">User Settings</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6 text-black">Blog Space Settings</h2>
          
          <div className="space-y-6">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                placeholder="Your public display name"
              />
            </div>

            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-2">
                Subdomain
              </label>
              <div className="flex">
                <input
                  type="text"
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  placeholder="your-subdomain"
                />
                <span className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-md">
                  .from.cafe
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Use letters, numbers, and hyphens only. Must be unique.
              </p>
            </div>

            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                Custom Domain (Optional)
              </label>
              <input
                type="text"
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                placeholder="yourdomain.com"
              />
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-500">
                  Point your domain&apos;s DNS to our servers for custom domain support.
                </p>
                <div className="flex items-center space-x-4">
                  <a
                    href="/site/domains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    📖 View detailed setup instructions
                  </a>
                  {domain && (
                    <div className="flex items-center space-x-3 text-sm">
                      <div>
                        <span className="text-gray-500">Status: </span>
                        <span className="text-yellow-600">⏳ Pending verification</span>
                      </div>
                      <button
                        onClick={() => {
                          // Simple verification placeholder
                          alert('Domain verification would be implemented here. For now, contact support to verify your domain.')
                        }}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                      >
                        Verify Now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">URL Format Preference</h3>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="usePathUrls"
                    name="urlFormat"
                    checked={!useSubdomain}
                    onChange={() => setUseSubdomain(false)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="usePathUrls" className="ml-2 block text-sm text-gray-900">
                    Use path-based URLs (default)
                  </label>
                </div>
                <div className="ml-6 text-sm text-gray-600">
                  Example: <code className="bg-gray-100 px-2 py-1 rounded">{exampleUrls.path}</code>
                </div>

                <div className="flex items-center">
                  <input
                    type="radio"
                    id="useSubdomainUrls"
                    name="urlFormat"
                    checked={useSubdomain}
                    onChange={() => setUseSubdomain(true)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="useSubdomainUrls" className="ml-2 block text-sm text-gray-900">
                    Use subdomain URLs
                  </label>
                </div>
                <div className="ml-6 text-sm text-gray-600">
                  Example: <code className="bg-gray-100 px-2 py-1 rounded">{exampleUrls.subdomain}</code>
                  {!subdomain && (
                    <div className="text-red-600 mt-1">
                      ⚠️ Subdomain is required for this option
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>How this works:</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• <strong>Path-based URLs:</strong> Always work, no setup required</li>
                  <li>• <strong>Subdomain URLs:</strong> Require wildcard DNS configuration (*.from.cafe)</li>
                  <li>• Your &quot;View Blog&quot; links in the dashboard will use your selected format</li>
                  <li>• If subdomain is not configured properly, visitors will get a 404 error</li>
                </ul>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={handleSave}
                disabled={saving || (useSubdomain && !subdomain)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}