'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'

interface BlogSpace {
  id: string
  displayName: string
  slug: string
  subdomain: string | null
  domain: string | null
  isActive: boolean
}

export default function UserSettingsPage() {
  const { status } = useSession()
  const params = useParams()
  const slug = params.slug as string
  const router = useRouter()
  const [blogSpace, setBlogSpace] = useState<BlogSpace | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    displayName: '',
    subdomain: '',
    domain: ''
  })

  const fetchBlogSpace = useCallback(async () => {
    try {
      const response = await fetch('/api/user/blog-space')
      if (!response.ok) throw new Error('Failed to fetch blog space')
      
      const data = await response.json()
      
      if (!data.user) {
        setError('No blog space found for user')
        setLoading(false)
        return
      }

      // Check if the slug matches
      if (data.user.slug !== slug) {
        setError('Blog space slug mismatch')
        setLoading(false)
        return
      }
      
      setBlogSpace(data.user)
      setFormData({
        displayName: data.user.displayName,
        subdomain: data.user.subdomain || '',
        domain: data.user.domain || ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog space')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    
    if (status === 'authenticated' && params.slug) {
      fetchBlogSpace()
    }
  }, [status, params.slug, router, fetchBlogSpace])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!blogSpace) return

    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const response = await fetch('/api/user/blog-space', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.displayName,
          subdomain: formData.subdomain,
          domain: formData.domain
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update blog space')
      }

      const data = await response.json()
      setBlogSpace(data.user)
      setSuccess('Settings updated successfully!')
      
      // If slug changed, redirect to new URL
      if (data.user.slug !== slug) {
        router.push(`/${data.user.slug}/dashboard/settings`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!blogSpace) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Blog Space Not Found</h1>
          <p className="text-gray-600">You don&apos;t have access to this blog space or it doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  // User can always edit their own tenant
  const canEdit = true

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Blog Settings</h1>
            <p className="text-gray-600">
              Manage your blog space configuration and domain settings
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              Main Dashboard
            </button>
            <button
              onClick={() => router.push('/api/auth/signout')}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Blog Space Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              disabled={!canEdit}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="My Organization"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Display name for your blog space
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subdomain
            </label>
            <input
              type="text"
              value={formData.subdomain}
              onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
              disabled={!canEdit}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="myorg"
              pattern="[a-z0-9-]+"
            />
            <p className="text-sm text-gray-500 mt-1">
              {formData.subdomain ? 
                `Your site will be available at: ${formData.subdomain}.from.cafe` :
                'Optional: Creates a subdomain for your blog space'
              }
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Domain
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              disabled={!canEdit}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="example.com"
            />
            <p className="text-sm text-gray-500 mt-1">
              Optional: Connect your own domain name
            </p>
            {formData.domain && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>DNS Setup Required:</strong> Point your domain to Vercel&apos;s nameservers for custom domain functionality.
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Current Access URLs</h3>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Path-based:</strong>{' '}
                <a 
                  href={`/${blogSpace.slug}`}
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  /{blogSpace.slug}
                </a>
              </div>
              {blogSpace.subdomain && (
                <div>
                  <strong>Subdomain:</strong>{' '}
                  <span className="text-gray-600">
                    {blogSpace.subdomain}.from.cafe (available when deployed)
                  </span>
                </div>
              )}
              {blogSpace.domain && (
                <div>
                  <strong>Custom Domain:</strong>{' '}
                  <span className="text-gray-600">
                    {blogSpace.domain} (requires DNS setup)
                  </span>
                </div>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/${blogSpace.slug}/dashboard`)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}