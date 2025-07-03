'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Tenant {
  id: string
  name: string
  slug: string
  subdomain: string | null
  domain: string | null
  isActive: boolean
  tenantUsers: Array<{ role: string }>
  blogs: Array<{
    id: string
    title: string
    slug: string
    isPublic: boolean
  }>
  _count: { blogs: number }
}

export default function TenantsPage() {
  const { data: session, status } = useSession()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    subdomain: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/signin')
    }
    
    if (status === 'authenticated') {
      fetchTenants()
    }
  }, [status])

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants')
      if (!response.ok) throw new Error('Failed to fetch tenants')
      const data = await response.json()
      setTenants(data.tenants)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tenants')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create tenant')
      }
      
      await fetchTenants()
      setShowCreateForm(false)
      setFormData({ name: '', slug: '', subdomain: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant')
    }
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  if (status === 'loading' || loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Your Tenants</h1>
        <p className="text-gray-600 mb-6">
          Manage your organizations and create new tenant spaces
        </p>
        
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create New Tenant
          </button>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create New Tenant</h2>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tenant Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setFormData({
                      ...formData,
                      name,
                      slug: generateSlug(name)
                    })
                  }}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Organization"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slug (URL identifier)
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="my-organization"
                  pattern="[a-z0-9-]+"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Will be used for path-based access: /tenant/{formData.slug}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subdomain (optional)
                </label>
                <input
                  type="text"
                  value={formData.subdomain}
                  onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="myorg"
                  pattern="[a-z0-9-]+"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Will be used for subdomain access: {formData.subdomain || 'myorg'}.from.cafe
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Tenant
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setError(null)
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No tenants created yet</p>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Tenant
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">{tenant.name}</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {tenant.tenantUsers[0]?.role}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600">
                  <strong>Slug:</strong> {tenant.slug}
                </p>
                {tenant.subdomain && (
                  <p className="text-sm text-gray-600">
                    <strong>Subdomain:</strong> {tenant.subdomain}.from.cafe
                  </p>
                )}
                {tenant.domain && (
                  <p className="text-sm text-gray-600">
                    <strong>Custom Domain:</strong> {tenant.domain}
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  <strong>Blogs:</strong> {tenant._count.blogs}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/tenant/${tenant.slug}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View Public
                </Link>
                <Link
                  href={`/tenant/${tenant.slug}/dashboard`}
                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}