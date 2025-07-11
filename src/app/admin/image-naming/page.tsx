'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface ImageNamingDecision {
  id: string
  postId: string
  originalHash: string
  blobFilename: string
  blobUrl: string
  namingSource: string
  originalTitle?: string
  extractedDate?: string
  exifMetadata?: Record<string, unknown>
  originalFilename?: string
  decisionReason?: string
  prefixCompressed?: boolean
  originalCamera?: string
  originalLens?: string
  createdAt: string
  updatedAt: string
  post?: {
    id: string
    title: string
    slug: string
    blog: {
      title: string
      slug: string
    }
  } | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function ImageNamingAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [decisions, setDecisions] = useState<ImageNamingDecision[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })
  const [filters, setFilters] = useState({
    postId: '',
    namingSource: ''
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    newFilename: '',
    newNamingSource: 'TITLE',
    newDecisionReason: ''
  })

  // Check admin access
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') {
      router.push('/')
      return
    }
  }, [session, status, router])

  // Fetch decisions
  const fetchDecisions = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.postId && { postId: filters.postId }),
        ...(filters.namingSource && { namingSource: filters.namingSource })
      })
      
      const response = await fetch(`/api/admin/image-naming-decisions?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setDecisions(data.data.decisions)
        setPagination(data.data.pagination)
      } else {
        console.error('Failed to fetch decisions:', data.error)
      }
    } catch (error) {
      console.error('Error fetching decisions:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.limit, filters.postId, filters.namingSource])

  useEffect(() => {
    if ((session?.user as { role?: string })?.role === 'ADMIN') {
      fetchDecisions()
    }
  }, [session, filters, fetchDecisions])

  const handleEdit = (decision: ImageNamingDecision) => {
    setEditingId(decision.id)
    setEditForm({
      newFilename: decision.blobFilename,
      newNamingSource: decision.namingSource,
      newDecisionReason: decision.decisionReason || ''
    })
  }

  const handleSave = async (id: string) => {
    try {
      const response = await fetch('/api/admin/image-naming-decisions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm })
      })
      
      const data = await response.json()
      if (data.success) {
        setEditingId(null)
        fetchDecisions(pagination.page)
        alert('Image naming decision updated successfully!')
      } else {
        alert('Failed to update: ' + data.error)
      }
    } catch (error) {
      console.error('Error updating decision:', error)
      alert('Failed to update image naming decision')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm({ newFilename: '', newNamingSource: 'TITLE', newDecisionReason: '' })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getNamingSourceColor = (source: string) => {
    switch (source) {
      case 'TITLE': return 'bg-green-100 text-green-800'
      case 'EXIF_DATE': return 'bg-blue-100 text-blue-800'
      case 'POST_DATE': return 'bg-yellow-100 text-yellow-800'
      case 'ORIGINAL_FILENAME': return 'bg-purple-100 text-purple-800'
      case 'CONTENT_HASH': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (status === 'loading') {
    return <div className="p-6">Loading...</div>
  }

  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') {
    return <div className="p-6">Access denied</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Image Naming Decisions</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Admin Console
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Dashboard
              </button>
            </div>
          </div>
          <p className="mt-2 text-gray-600">
            Review how image blob names were generated and manage renaming decisions.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Post ID
              </label>
              <input
                type="text"
                value={filters.postId}
                onChange={(e) => setFilters(prev => ({ ...prev, postId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Filter by post ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Naming Source
              </label>
              <select
                value={filters.namingSource}
                onChange={(e) => setFilters(prev => ({ ...prev, namingSource: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Sources</option>
                <option value="TITLE">Title</option>
                <option value="EXIF_DATE">EXIF Date</option>
                <option value="POST_DATE">Post Date</option>
                <option value="ORIGINAL_FILENAME">Original Filename</option>
                <option value="CONTENT_HASH">Content Hash</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Image Naming Decisions ({pagination.total} total)
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : decisions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No image naming decisions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Post
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Blob Filename
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Naming Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Decision Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {decisions.map((decision) => (
                    <tr key={decision.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {decision.post?.title || 'Deleted Post'}
                          </div>
                          <div className="text-gray-500">
                            {decision.post?.blog?.title || 'Unknown Blog'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingId === decision.id ? (
                          <input
                            type="text"
                            value={editForm.newFilename}
                            onChange={(e) => setEditForm(prev => ({ ...prev, newFilename: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        ) : (
                          <div className="text-sm">
                            <div className="font-mono text-gray-900">{decision.blobFilename}</div>
                            <a 
                              href={decision.blobUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              View Image →
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingId === decision.id ? (
                          <select
                            value={editForm.newNamingSource}
                            onChange={(e) => setEditForm(prev => ({ ...prev, newNamingSource: e.target.value }))}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="TITLE">Title</option>
                            <option value="EXIF_DATE">EXIF Date</option>
                            <option value="POST_DATE">Post Date</option>
                            <option value="ORIGINAL_FILENAME">Original Filename</option>
                            <option value="CONTENT_HASH">Content Hash</option>
                          </select>
                        ) : (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getNamingSourceColor(decision.namingSource)}`}>
                            {decision.namingSource}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {decision.originalTitle && (
                            <div><strong>Title:</strong> {decision.originalTitle}</div>
                          )}
                          {decision.originalFilename && (
                            <div><strong>Filename:</strong> {decision.originalFilename}</div>
                          )}
                          {decision.extractedDate && (
                            <div><strong>Date:</strong> {decision.extractedDate}</div>
                          )}
                          {decision.exifMetadata && (
                            <div className="text-xs text-gray-500 mt-1">
                              EXIF: {(decision.exifMetadata as { make?: string; model?: string }).make} {(decision.exifMetadata as { make?: string; model?: string }).model}
                            </div>
                          )}
                          {decision.prefixCompressed && (
                            <div className="text-xs text-amber-600 mt-1 font-medium">
                              📎 Prefix Compressed
                            </div>
                          )}
                          {decision.originalCamera && (
                            <div className="text-xs text-gray-500 mt-1">
                              <strong>Camera:</strong> {decision.originalCamera}
                            </div>
                          )}
                          {decision.originalLens && (
                            <div className="text-xs text-gray-500 mt-1">
                              <strong>Lens:</strong> {decision.originalLens}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingId === decision.id ? (
                          <textarea
                            value={editForm.newDecisionReason}
                            onChange={(e) => setEditForm(prev => ({ ...prev, newDecisionReason: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            rows={2}
                          />
                        ) : (
                          <div className="text-sm text-gray-600 max-w-xs truncate">
                            {decision.decisionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(decision.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingId === decision.id ? (
                          <div className="space-x-2">
                            <button
                              onClick={() => handleSave(decision.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(decision)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => fetchDecisions(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchDecisions(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}