'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function NewBlogForm() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [creating, setCreating] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [checkingSlug, setCheckingSlug] = useState(false)
  
  // Pre-populate with notebook info if coming from notebook selection
  const notebookGuid = searchParams.get('notebook')
  const notebookName = searchParams.get('name')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
    
    // If coming from notebook selection, pre-fill the title
    if (notebookName) {
      setTitle(`${decodeURIComponent(notebookName)} Blog`)
      setSlug(generateSlug(decodeURIComponent(notebookName) + ' Blog'))
    }
  }, [status, router, notebookName])

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const checkSlugAvailability = async (slugToCheck: string) => {
    if (!slugToCheck.trim()) {
      setSlugError('')
      return
    }

    setCheckingSlug(true)
    try {
      const response = await fetch(`/api/blogs/check-slug?slug=${encodeURIComponent(slugToCheck)}`)
      const data = await response.json()
      
      if (data.exists) {
        setSlugError('This URL slug is already taken. Please choose a different one.')
      } else {
        setSlugError('')
      }
    } catch (error) {
      console.error('Error checking slug:', error)
      setSlugError('')
    } finally {
      setCheckingSlug(false)
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    const newSlug = generateSlug(newTitle)
    setSlug(newSlug)
    if (newSlug) {
      checkSlugAvailability(newSlug)
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSlug = e.target.value
    setSlug(newSlug)
    if (newSlug) {
      checkSlugAvailability(newSlug)
    } else {
      setSlugError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const response = await fetch('/api/blogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          slug,
          isPublic,
          evernoteNotebook: notebookGuid || undefined
        }),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/dashboard/blogs/${data.blog.id}`)
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to create blog')
      }
    } catch (error) {
      console.error('Error creating blog:', error)
      alert('Failed to create blog. Please try again.')
    } finally {
      setCreating(false)
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Create New Blog</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {notebookName && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
            <p>
              <strong>Connecting to Evernote Notebook:</strong> {decodeURIComponent(notebookName)}
            </p>
            <p className="text-sm mt-1">
              This blog will automatically sync with your selected Evernote notebook.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-black mb-2">
                Blog Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={handleTitleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                placeholder="Enter your blog title"
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
                placeholder="Brief description of your blog"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-black mb-2">
                URL Slug
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-black text-sm">
                  /blog/
                </span>
                <input
                  type="text"
                  id="slug"
                  value={slug}
                  onChange={handleSlugChange}
                  required
                  className={`flex-1 px-3 py-2 border rounded-r-md focus:outline-none focus:ring-2 text-black ${
                    slugError 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="blog-url-slug"
                />
              </div>
              {slugError ? (
                <p className="text-sm text-red-600 mt-1">{slugError}</p>
              ) : (
                <p className="text-sm text-black mt-1">
                  This will be your blog&apos;s URL: /blog/{slug}
                </p>
              )}
              {checkingSlug && (
                <p className="text-sm text-blue-600 mt-1">Checking availability...</p>
              )}
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

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !title.trim() || !slug.trim() || !!slugError || checkingSlug}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Blog'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

export default function NewBlog() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewBlogForm />
    </Suspense>
  )
}