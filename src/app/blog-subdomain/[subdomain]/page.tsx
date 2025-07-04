'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { notFound } from 'next/navigation'

interface Blog {
  id: string
  title: string
  slug: string
  description: string
  author?: string
  subdomain?: string
  urlFormat?: string
  isPublic: boolean
  user: {
    slug: string
  }
  posts: Array<{
    id: string
    title: string
    slug: string
    excerpt?: string
    publishedAt: string
    isPublished: boolean
  }>
}

export default function BlogSubdomainPage() {
  const params = useParams()
  const subdomain = params.subdomain as string
  const [blog, setBlog] = useState<Blog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBlogBySubdomain() {
      try {
        const response = await fetch(`/api/blogs/by-subdomain/${subdomain}`)
        
        if (response.status === 404) {
          notFound()
          return
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch blog')
        }
        
        const data = await response.json()
        setBlog(data.blog)
      } catch (err) {
        console.error('Error fetching blog:', err)
        setError('Failed to load blog')
      } finally {
        setLoading(false)
      }
    }

    if (subdomain) {
      fetchBlogBySubdomain()
    }
  }, [subdomain])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Blog Not Found</h1>
          <p className="text-gray-600">The subdomain &quot;{subdomain}&quot; is not associated with any blog.</p>
        </div>
      </div>
    )
  }

  // Redirect to the actual blog page using the user slug and blog slug
  if (typeof window !== 'undefined') {
    window.location.href = `/${blog.user.slug}/${blog.slug}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to {blog.title}...</p>
      </div>
    </div>
  )
}