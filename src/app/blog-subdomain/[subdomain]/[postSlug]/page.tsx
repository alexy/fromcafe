'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { notFound } from 'next/navigation'

interface Blog {
  id: string
  title: string
  slug: string
  subdomain?: string
  user: {
    slug: string
  }
}

export default function BlogSubdomainPostPage() {
  const params = useParams()
  const subdomain = params.subdomain as string
  const postSlug = params.postSlug as string
  const [blog, setBlog] = useState<Blog | null>(null)
  const [loading, setLoading] = useState(true)

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
        notFound()
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

  if (!blog) {
    notFound()
    return null
  }

  // Redirect to the actual post page using the user slug, blog slug, and post slug
  if (typeof window !== 'undefined') {
    window.location.href = `/${blog.user.slug}/${blog.slug}/${postSlug}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to post...</p>
      </div>
    </div>
  )
}