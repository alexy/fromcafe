'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { validateUserSlug, generateSafeSlug } from '@/config/site'

export default function OnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    displayName: '',
    slug: '',
    subdomain: ''
  })
  const [slugError, setSlugError] = useState<string | null>(null)

  const checkExistingBlogSpace = useCallback(async () => {
    try {
      const response = await fetch('/api/user/blog-space')
      if (response.ok) {
        const data = await response.json()
        if (data.user?.slug) {
          // User already has blog space, redirect to dashboard
          router.push(`/${data.user.slug}/dashboard`)
        }
      }
    } catch (error) {
      console.error('Error checking blog space:', error)
    }
  }, [router])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    
    // Check if user already has a blog space
    if (status === 'authenticated') {
      checkExistingBlogSpace()
    }
  }, [status, router, checkExistingBlogSpace])

  const handleSlugChange = (slug: string) => {
    const validation = validateUserSlug(slug)
    setSlugError(validation.valid ? null : validation.error || null)
    setFormData({ ...formData, slug })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formData.displayName,
          slug: formData.slug,
          subdomain: formData.subdomain
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to complete setup')
      }

      const data = await response.json()
      
      // Redirect to user dashboard
      router.push(`/${data.user.slug}/dashboard`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
                Welcome to FromCafe!
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Let&apos;s set up your blogging space
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Sign out
            </button>
          </div>
          
          {session?.user && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Signed in as: <span className="font-medium">{session.user.email}</span>
              </p>
            </div>
          )}
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                Your Blog Space Name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={formData.displayName}
                onChange={(e) => {
                  const name = e.target.value
                  setFormData({
                    ...formData,
                    displayName: name,
                    slug: generateSafeSlug(name)
                  })
                }}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="My Blog Space"
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be the name of your blogging organization
              </p>
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                URL Identifier (Slug)
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                required
                value={formData.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm ${
                  slugError ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="my-blog-space"
                pattern="[a-z0-9-]+"
              />
              {slugError && (
                <p className="mt-1 text-xs text-red-600">{slugError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Used for: /{formData.slug}
              </p>
            </div>

            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">
                Subdomain (Optional)
              </label>
              <input
                id="subdomain"
                name="subdomain"
                type="text"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="myblog"
                pattern="[a-z0-9-]+"
              />
              <p className="mt-1 text-xs text-gray-500">
                {formData.subdomain ? 
                  `Will be available at: ${formData.subdomain}.from.cafe` :
                  'Leave empty to set up later'
                }
              </p>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !!slugError || !formData.displayName || !formData.slug}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              You can always change these settings later
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}