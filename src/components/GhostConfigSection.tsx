'use client'

import { useState, useEffect } from 'react'

interface GhostBlogInfo {
  blog: {
    id: string
    title: string
    description?: string
    url: string
    ghostEnabled: boolean
    ghostPostCount: number
  }
  apiEndpoint: string
  authEndpoint: string
  currentToken?: {
    token: string
    expiresAt: string
  } | null
}

interface GhostToken {
  token: string
  expiresAt: string
  blog: {
    id: string
    title: string
    url: string
  }
}

interface AdminApiKey {
  id: string
  keyId: string
  secret?: string // Only present when just created
  name: string
  description?: string
  createdAt: string
  lastUsedAt?: string
  apiUrl?: string
  blogUrl?: string
}

interface GhostConfigSectionProps {
  blogId: string
}

export default function GhostConfigSection({ blogId }: GhostConfigSectionProps) {
  const [blogInfo, setBlogInfo] = useState<GhostBlogInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [currentToken, setCurrentToken] = useState<GhostToken | null>(null)
  const [tokenExpiry, setTokenExpiry] = useState('1y')
  
  // Admin API Key state
  const [adminApiKeys, setAdminApiKeys] = useState<AdminApiKey[]>([])
  const [creatingApiKey, setCreatingApiKey] = useState(false)
  const [newApiKeyName, setNewApiKeyName] = useState('iA Writer')

  useEffect(() => {
    fetchBlogInfo()
    fetchAdminApiKeys()
  }, [blogId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAdminApiKeys = async () => {
    try {
      const response = await fetch(`/api/admin-api-keys?blogId=${blogId}`)
      if (response.ok) {
        const data = await response.json()
        setAdminApiKeys(data.apiKeys || [])
      }
    } catch (error) {
      console.error('Error fetching Admin API Keys:', error)
    }
  }

  const createAdminApiKey = async () => {
    setCreatingApiKey(true)
    try {
      const response = await fetch('/api/admin-api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId,
          name: newApiKeyName || 'Admin API Key'
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Add the new key to the list (includes secret for initial display)
        setAdminApiKeys(prev => [data, ...prev])
        setNewApiKeyName('iA Writer') // Reset
      } else {
        alert(data.error || 'Failed to create Admin API Key')
      }
    } catch (error) {
      console.error('Error creating Admin API Key:', error)
      alert('Failed to create Admin API Key')
    } finally {
      setCreatingApiKey(false)
    }
  }

  const deleteAdminApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this Admin API Key? This cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin-api-keys?keyId=${keyId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAdminApiKeys(prev => prev.filter(key => key.keyId !== keyId))
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete Admin API Key')
      }
    } catch (error) {
      console.error('Error deleting Admin API Key:', error)
      alert('Failed to delete Admin API Key')
    }
  }

  const fetchBlogInfo = async () => {
    try {
      const response = await fetch(`/api/ghost/admin/auth?blogId=${blogId}`)
      if (response.ok) {
        const data = await response.json()
        setBlogInfo(data)
        
        // Set existing token if available
        if (data.currentToken) {
          setCurrentToken(data.currentToken)
        } else {
          setCurrentToken(null)
        }
      } else {
        console.error('Failed to fetch blog info')
      }
    } catch (error) {
      console.error('Error fetching blog info:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateToken = async () => {
    setGeneratingToken(true)
    try {
      const response = await fetch('/api/ghost/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId,
          expiresIn: tokenExpiry
        })
      })

      const data = await response.json()

      if (response.ok) {
        setCurrentToken(data)
        await fetchBlogInfo() // Refresh blog info
      } else {
        alert(data.error || 'Failed to generate token')
      }
    } catch (error) {
      console.error('Error generating token:', error)
      alert('Failed to generate token')
    } finally {
      setGeneratingToken(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
      alert('Failed to copy to clipboard')
    }
  }

  const formatTimeUntilExpiry = (expiresAt: string): string => {
    const expiry = new Date(expiresAt)
    const now = new Date()
    const diffMs = expiry.getTime() - now.getTime()
    
    if (diffMs <= 0) return 'Expired'
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''}`
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`
    return 'Less than 1 hour'
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading Ghost API status...</div>
  }

  if (!blogInfo) {
    return <div className="text-sm text-red-500">Failed to load Ghost API status</div>
  }

  return (
    <div className="space-y-6">
      {/* Admin API Keys Section */}
      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-blue-900">Admin API Keys</h3>
          <button
            onClick={createAdminApiKey}
            disabled={creatingApiKey}
            className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {creatingApiKey ? 'Creating...' : 'Create Key'}
          </button>
        </div>
        
        <div className="mb-3">
          <input
            type="text"
            value={newApiKeyName}
            onChange={(e) => setNewApiKeyName(e.target.value)}
            placeholder="Key name (e.g., iA Writer)"
            className="w-full px-3 py-2 border border-blue-300 rounded text-sm"
            disabled={creatingApiKey}
          />
        </div>
        
        <p className="text-sm text-blue-700 mb-4">
          Admin API Keys work with Ghost-compatible editors like iA Writer. They don&apos;t expire and are more secure than staff tokens.
        </p>
        
        {adminApiKeys.length > 0 && (
          <div className="space-y-3">
            {adminApiKeys.map((apiKey) => (
              <div key={apiKey.id} className="border border-blue-300 bg-white rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-blue-900">{apiKey.name}</h4>
                    <p className="text-xs text-blue-600">
                      Created: {new Date(apiKey.createdAt).toLocaleDateString()}
                      {apiKey.lastUsedAt && (
                        <span className="ml-2">
                          • Last used: {new Date(apiKey.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteAdminApiKey(apiKey.keyId)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
                
                {apiKey.secret && (
                  <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                    <h5 className="font-medium text-green-800 mb-2">⚠️ Save these credentials now!</h5>
                    <div className="space-y-2 text-sm">
                      <div>
                        <label className="block text-xs font-medium text-green-700">API URL:</label>
                        <div className="flex items-center space-x-2">
                          <code className="bg-white border px-2 py-1 rounded text-xs flex-1 break-all">
                            {apiKey.apiUrl}
                          </code>
                          <button
                            onClick={() => copyToClipboard(apiKey.apiUrl!)}
                            className="bg-green-600 text-white px-2 py-1 text-xs rounded hover:bg-green-700"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-green-700">Admin API Key:</label>
                        <div className="flex items-center space-x-2">
                          <code className="bg-white border px-2 py-1 rounded text-xs flex-1 break-all">
                            {apiKey.keyId}:{apiKey.secret}
                          </code>
                          <button
                            onClick={() => copyToClipboard(`${apiKey.keyId}:${apiKey.secret}`)}
                            className="bg-green-600 text-white px-2 py-1 text-xs rounded hover:bg-green-700"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      This secret will not be shown again. Save it in your Ghost client now.
                    </p>
                  </div>
                )}
                
                <div className="text-xs text-blue-700">
                  <strong>Key ID:</strong> <code className="bg-blue-100 px-1 rounded">{apiKey.keyId}</code>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {adminApiKeys.length === 0 && (
          <div className="text-center py-4 text-blue-600">
            <p className="text-sm">No Admin API Keys created yet.</p>
            <p className="text-xs mt-1">Create one to use with Ghost-compatible editors.</p>
          </div>
        )}
      </div>

      {/* Staff Token Section */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <div className={`w-3 h-3 rounded-full ${
            blogInfo.blog.ghostEnabled ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span className="text-black font-medium">
            Staff Tokens (Legacy) {blogInfo.blog.ghostEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-600">API Endpoint: </span>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
              {blogInfo.apiEndpoint}
            </code>
            <button
              onClick={() => copyToClipboard(blogInfo.apiEndpoint)}
              className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
            >
              Copy
            </button>
          </div>
          
          <div>
            <span className="text-gray-600">Blog URL: </span>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
              {blogInfo.blog.url}
            </code>
          </div>
          
          {blogInfo.blog.ghostEnabled && (
            <div>
              <span className="text-gray-600">Ghost Posts: </span>
              <span className="text-black">{blogInfo.blog.ghostPostCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Generate API Token
          </label>
          <div className="flex space-x-2 items-center">
            <select
              value={tokenExpiry}
              onChange={(e) => setTokenExpiry(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
              disabled={generatingToken}
            >
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="1y">1 year</option>
              <option value="never">Never</option>
            </select>
            <button
              onClick={generateToken}
              disabled={generatingToken}
              className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {generatingToken ? 'Generating...' : (currentToken ? 'Regenerate Token' : 'Generate Token')}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Generate an API token for Ghost clients to publish posts to this blog
          </p>
        </div>

        {currentToken && (
          <div className="border border-green-200 bg-green-50 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-green-800">API Token Generated</h4>
              <button
                onClick={() => setCurrentToken(null)}
                className="text-green-600 hover:text-green-800 text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-green-700 mb-1">
                  Bearer Token:
                </label>
                <div className="flex items-center space-x-2">
                  <code className="bg-white border border-green-200 px-2 py-1 rounded text-xs flex-1 break-all">
                    {currentToken.token}
                  </code>
                  <button
                    onClick={() => copyToClipboard(currentToken.token)}
                    className="bg-green-600 text-white px-2 py-1 text-xs rounded hover:bg-green-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-green-700">
                <strong>Expires:</strong> {formatTimeUntilExpiry(currentToken.expiresAt)} 
                <span className="ml-2 text-green-600">
                  ({new Date(currentToken.expiresAt).toLocaleString()})
                </span>
              </div>
              
              <div className="text-xs text-green-700">
                <strong>Usage:</strong> Include as Authorization header: 
                <code className="ml-1 bg-white px-1 border border-green-200 rounded">
                  Ghost {currentToken.token}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="font-medium text-blue-900 mb-2">📝 How to Use</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>1. Generate an API token above</p>
          <p>2. Use Ghost Admin API clients to publish posts:</p>
          <div className="flex items-center space-x-2 mt-1">
            <code className="bg-white border border-blue-200 px-2 py-1 rounded text-xs flex-1">
              {blogInfo.apiEndpoint}
            </code>
            <button
              onClick={() => copyToClipboard(blogInfo.apiEndpoint)}
              className="bg-blue-600 text-white px-2 py-1 text-xs rounded hover:bg-blue-700"
            >
              Copy
            </button>
          </div>
          <p>3. Include the token in Authorization header:</p>
          <code className="block bg-white border border-blue-200 px-2 py-1 rounded text-xs mt-1">
            Authorization: Ghost [your-token]
          </code>
          <p>4. Posts will appear in your blog automatically</p>
        </div>
      </div>
    </div>
  )
}