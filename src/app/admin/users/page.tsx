'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  email: string
  name: string | null
  displayName: string | null
  slug: string | null
  subdomain: string | null
  domain: string | null
  role: 'USER' | 'ADMIN'
  isActive: boolean
  createdAt: string
  _count: {
    blogs: number
  }
}

export default function AdminUsersPage() {
  console.log('🚀 AdminUsersPage component mounted!')
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'USER' | 'ADMIN'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  // Check admin authentication
  useEffect(() => {
    const adminAuth = sessionStorage.getItem('admin_authenticated')
    if (adminAuth !== 'true') {
      router.push('/admin')
      return
    }
  }, [router])

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        if (response.status === 403) {
          router.push('/dashboard')
          return
        }
        throw new Error('Failed to fetch users')
      }
      
      const data = await response.json()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    console.log('Admin users page - status:', status)
    
    if (status === 'loading') {
      return // Wait for session to load
    }
    
    if (status === 'unauthenticated') {
      console.log('Not authenticated, redirecting to signin')
      // Store the intended destination before redirecting to signin
      sessionStorage.setItem('admin_return_url', '/admin/users')
      router.push('/auth/signin?callbackUrl=' + encodeURIComponent('/admin/users'))
      return
    }
    
    if (status === 'authenticated') {
      const adminAuth = sessionStorage.getItem('admin_authenticated')
      console.log('Authenticated, admin auth status:', adminAuth)
      
      if (adminAuth === 'true') {
        console.log('Admin authenticated, fetching users')
        fetchUsers()
      } else {
        console.log('Not admin authenticated, redirecting to admin login')
        // Store the intended destination and redirect to admin login
        sessionStorage.setItem('admin_return_url', '/admin/users')
        router.push('/admin')
      }
    }
  }, [status, router, fetchUsers])

  const updateUserRole = async (userId: string, newRole: 'USER' | 'ADMIN') => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user role')
      }

      // Refresh users list
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user role')
    }
  }

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user status')
      }

      // Refresh users list
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user status')
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.slug?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'ACTIVE' && user.isActive) ||
      (statusFilter === 'INACTIVE' && !user.isActive)
    
    return matchesSearch && matchesRole && matchesStatus
  })

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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">User Management</h1>
            <p className="text-gray-600">
              Manage user accounts, roles, and permissions
            </p>
          </div>
          <Link
            href="/admin"
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Admin
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Users
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by email, name, or slug..."
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Roles</option>
                <option value="USER">Users</option>
                <option value="ADMIN">Admins</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                Showing {filteredUsers.length} of {users.length} users
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Blog Space
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Blogs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const isCurrentUser = (session?.user as any)?.id === user.id
                return (
                <tr key={user.id} className={`hover:bg-gray-50 ${isCurrentUser ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        {user.name || user.email}
                        {isCurrentUser && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      {user.displayName && (
                        <div className="text-sm text-gray-500">&quot;{user.displayName}&quot;</div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.slug ? (
                      <div>
                        <div className="text-sm text-gray-900">/{user.slug}</div>
                        {user.subdomain && (
                          <div className="text-sm text-gray-500">{user.subdomain}.from.cafe</div>
                        )}
                        {user.domain && (
                          <div className="text-sm text-gray-500">{user.domain}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Not setup</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user._count.blogs}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isCurrentUser ? (
                      <span className="text-sm text-gray-900 font-medium">
                        {user.role} (You)
                      </span>
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value as 'USER' | 'ADMIN')}
                        className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleUserStatus(user.id, user.isActive)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isActive
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {user.slug && (
                      <Link
                        href={`/${user.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        View
                      </Link>
                    )}
                    {user.slug && (
                      <Link
                        href={`/${user.slug}/dashboard`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Dashboard
                      </Link>
                    )}
                  </td>
                </tr>
              )
              })}
            </tbody>
          </table>
        </div>
        
        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No users found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  )
}