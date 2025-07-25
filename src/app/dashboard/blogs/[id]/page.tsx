'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAvailableThemes } from '@/lib/themes/registry'
import GhostConfigSection from '@/components/GhostConfigSection'
import type { UserSyncResult } from '@/lib/sync'

interface Blog {
  id: string
  title: string
  slug: string
  description: string
  author?: string
  customDomain?: string
  subdomain?: string
  urlFormat?: string
  evernoteNotebook?: string
  theme: string
  isPublic: boolean
  showCameraMake: boolean
  lastSyncedAt?: string
  lastSyncAttemptAt?: string
  lastSyncUpdateCount?: number
  enableSyncEndpoint?: boolean
  syncEndpointPassword?: string
  _count: {
    posts: number
  }
}

// Helper function to determine the correct blog URL based on blog preferences
function getBlogUrl(blog: Blog, userSlug: string): string {
  // Custom domain takes priority
  if (blog.urlFormat === 'custom' && blog.customDomain) {
    return `https://${blog.customDomain}`
  }
  // Subdomain URLs
  if (blog.urlFormat === 'subdomain' && blog.subdomain) {
    return `https://${blog.subdomain}.from.cafe`
  }
  // Default path-based URLs
  return `https://from.cafe/${userSlug}/${blog.slug}`
}

// Helper function to generate URL preview based on current form state
function getPreviewUrl(format: string, subdomain: string, customDomain: string, blogSlug: string, userSlug: string): string {
  if (format === 'custom' && customDomain.trim()) {
    return `https://${customDomain.trim()}`
  }
  if (format === 'subdomain' && subdomain.trim()) {
    return `https://${subdomain.trim()}.from.cafe`
  }
  return `https://from.cafe/${userSlug}/${blogSlug}`
}

export default function BlogSettings() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const blogId = params.id as string
  
  const [blog, setBlog] = useState<Blog | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Auto-save state tracking
  const [autoSaving, setAutoSaving] = useState<Record<string, boolean>>({})
  const [autoSaveSuccess, setAutoSaveSuccess] = useState<Record<string, boolean>>({})
  const [autoSaveError, setAutoSaveError] = useState<Record<string, string | null>>({})
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [theme, setTheme] = useState('default')
  const [showCameraMake, setShowCameraMake] = useState(false)
  const [urlFormat, setUrlFormat] = useState<'path' | 'subdomain' | 'custom'>('path')
  const [blogSubdomain, setBlogSubdomain] = useState('')
  const [blogCustomDomain, setBlogCustomDomain] = useState('')
  
  // Track original values for change detection
  const [originalTitle, setOriginalTitle] = useState('')
  const [originalDescription, setOriginalDescription] = useState('')
  const [originalAuthor, setOriginalAuthor] = useState('')
  const [originalIsPublic, setOriginalIsPublic] = useState(true)
  const [originalTheme, setOriginalTheme] = useState('default')
  const [originalShowCameraMake, setOriginalShowCameraMake] = useState(false)
  const [originalUrlFormat, setOriginalUrlFormat] = useState<'path' | 'subdomain' | 'custom'>('path')
  const [originalBlogSubdomain, setOriginalBlogSubdomain] = useState('')
  const [originalBlogCustomDomain, setOriginalBlogCustomDomain] = useState('')
  const [notebooks, setNotebooks] = useState<Array<{guid: string, name: string}>>([])
  const [showNotebooks, setShowNotebooks] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [notebookName, setNotebookName] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<UserSyncResult | null>(null)
  const [showSyncResults, setShowSyncResults] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [resettingSync, setResettingSync] = useState(false)
  const [enableSyncEndpoint, setEnableSyncEndpoint] = useState(false)
  const [syncEndpointPassword, setSyncEndpointPassword] = useState('')
  const [userBlogSpace, setUserBlogSpace] = useState<{slug: string; subdomain?: string; useSubdomain?: boolean} | null>(null)
  const [domainStatus, setDomainStatus] = useState<{verified: boolean; checking: boolean; error?: string} | null>(null)
  const [postStats, setPostStats] = useState<{
    published: number
    unpublished: number
    evernoteCount: number
    ghostCount: number
    totalCount: number
    publishedEvernoteCount: number
    publishedGhostCount: number
    unpublishedEvernoteCount: number
    unpublishedGhostCount: number
  } | null>(null)
  
  // Debounce timers for text inputs
  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout>>({})
  
  // Auto-save utility function
  const autoSaveField = async (fieldName: string, value: string | boolean) => {
    // Set auto-saving state
    setAutoSaving(prev => ({ ...prev, [fieldName]: true }))
    setAutoSaveError(prev => ({ ...prev, [fieldName]: null }))
    setAutoSaveSuccess(prev => ({ ...prev, [fieldName]: false }))
    
    try {
      const response = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [fieldName]: value }),
      })

      if (response.ok) {
        const data = await response.json()
        setBlog(data.blog)
        
        // Update original value to reflect saved state
        if (fieldName === 'showCameraMake') {
          setOriginalShowCameraMake(value as boolean)
        } else if (fieldName === 'isPublic') {
          setOriginalIsPublic(value as boolean)
        } else if (fieldName === 'theme') {
          setOriginalTheme(value as string)
        } else if (fieldName === 'title') {
          setOriginalTitle(value as string)
        } else if (fieldName === 'description') {
          setOriginalDescription(value as string)
        } else if (fieldName === 'author') {
          setOriginalAuthor(value as string)
        } else if (fieldName === 'enableSyncEndpoint') {
          // No need to track original state for this field
        } else if (fieldName === 'syncEndpointPassword') {
          // No need to track original state for this field
        }
        
        // Show success indicator
        setAutoSaveSuccess(prev => ({ ...prev, [fieldName]: true }))
        
        // Clear success indicator after 2 seconds
        setTimeout(() => {
          setAutoSaveSuccess(prev => ({ ...prev, [fieldName]: false }))
        }, 2000)
      } else {
        const errorData = await response.json()
        setAutoSaveError(prev => ({ ...prev, [fieldName]: errorData.error || 'Failed to save' }))
      }
    } catch (error) {
      console.error(`Error auto-saving ${fieldName}:`, error)
      setAutoSaveError(prev => ({ ...prev, [fieldName]: 'Failed to save' }))
    } finally {
      setAutoSaving(prev => ({ ...prev, [fieldName]: false }))
    }
  }
  
  // Debounced auto-save for text inputs (waits 1 second after user stops typing)
  const debouncedAutoSave = (fieldName: string, value: string) => {
    // Clear existing timer
    if (debounceTimersRef.current[fieldName]) {
      clearTimeout(debounceTimersRef.current[fieldName])
    }
    
    // Set new timer
    debounceTimersRef.current[fieldName] = setTimeout(() => {
      autoSaveField(fieldName, value)
    }, 1000)
  }
  
  // Cleanup timers on unmount
  useEffect(() => {
    const timers = debounceTimersRef.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  // Generate random password for sync endpoint
  const generateSyncPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let password = ''
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  // Handle sync endpoint toggle
  const handleSyncEndpointToggle = async (enabled: boolean) => {
    if (enabled && !syncEndpointPassword) {
      // Generate a new password if enabling and no password exists
      const newPassword = generateSyncPassword()
      setSyncEndpointPassword(newPassword)
      await autoSaveField('syncEndpointPassword', newPassword)
    }
    setEnableSyncEndpoint(enabled)
    await autoSaveField('enableSyncEndpoint', enabled)
  }

  // Copy sync endpoint URL to clipboard
  const copySyncEndpointUrl = async () => {
    if (!blog || !enableSyncEndpoint || !syncEndpointPassword) return
    
    const baseUrl = window.location.origin
    const syncUrl = `${baseUrl}/api/blogs/${blog.id}/sync-external?password=${syncEndpointPassword}`
    
    try {
      await navigator.clipboard.writeText(syncUrl)
      alert('Sync endpoint URL copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      // Fallback: show URL in a prompt
      prompt('Copy this sync endpoint URL:', syncUrl)
    }
  }
  
  const [addingDomain, setAddingDomain] = useState(false)
  const [removingDomain, setRemovingDomain] = useState(false)
  const [verificationReport, setVerificationReport] = useState<{
    success?: boolean;
    verified?: boolean;
    domain?: string;
    timestamp?: string;
    checks?: Record<string, { status: string; message: string }>;
    recommendations?: string[];
  } | null>(null)
  const [showVerificationReport, setShowVerificationReport] = useState(false)

  const fetchNotebookName = useCallback(async (notebookGuid: string) => {
    try {
      console.log('Fetching notebook name for GUID:', notebookGuid)
      const response = await fetch('/api/evernote/notebooks')
      if (response.ok) {
        const data = await response.json()
        console.log('Available notebooks:', data.notebooks)
        const notebook = data.notebooks.find((nb: { guid: string; name: string }) => nb.guid === notebookGuid)
        console.log('Found notebook:', notebook)
        if (notebook) {
          setNotebookName(notebook.name)
          
          // Store the notebook name in database to avoid future API calls
          try {
            await fetch(`/api/blogs/${blogId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ evernoteNotebookName: notebook.name })
            })
            console.log('Stored notebook name in database')
          } catch (storeError) {
            console.error('Failed to store notebook name:', storeError)
          }
        } else {
          console.log('Notebook not found in list')
        }
      } else {
        console.log('Failed to fetch notebooks:', response.status)
      }
    } catch (error) {
      console.error('Error fetching notebook name:', error)
    }
  }, [blogId])

  const fetchPostStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/blogs/${blogId}/stats`)
      if (response.ok) {
        const data = await response.json()
        setPostStats(data)
      }
    } catch (error) {
      console.error('Error fetching post stats:', error)
    }
  }, [blogId])

  const fetchBlog = useCallback(async () => {
    try {
      const response = await fetch(`/api/blogs/${blogId}`)
      if (response.ok) {
        const data = await response.json()
        setBlog(data.blog)
        setTitle(data.blog.title)
        setDescription(data.blog.description || '')
        setAuthor(data.blog.author || '')
        setIsPublic(data.blog.isPublic)
        setTheme(data.blog.theme || 'default')
        setShowCameraMake(data.blog.showCameraMake || false)
        
        // Set URL format fields
        const currentUrlFormat = data.blog.urlFormat || 'path'
        setUrlFormat(currentUrlFormat)
        setBlogSubdomain(data.blog.subdomain || '')
        setBlogCustomDomain(data.blog.customDomain || '')
        
        // Set original values for change detection
        setOriginalTitle(data.blog.title)
        setOriginalDescription(data.blog.description || '')
        setOriginalAuthor(data.blog.author || '')
        setOriginalIsPublic(data.blog.isPublic)
        setOriginalTheme(data.blog.theme || 'default')
        setOriginalShowCameraMake(data.blog.showCameraMake || false)
        setOriginalUrlFormat(currentUrlFormat)
        setOriginalBlogSubdomain(data.blog.subdomain || '')
        setOriginalBlogCustomDomain(data.blog.customDomain || '')
        
        // Set sync endpoint fields
        setEnableSyncEndpoint(data.blog.enableSyncEndpoint || false)
        setSyncEndpointPassword(data.blog.syncEndpointPassword || '')
        
        // If notebook is connected, fetch the notebook name
        if (data.blog.evernoteNotebook) {
          console.log('Blog has evernoteNotebook:', data.blog.evernoteNotebook)
          // Use stored notebook name if available, otherwise fetch it once
          if (data.blog.evernoteNotebookName) {
            setNotebookName(data.blog.evernoteNotebookName)
          } else {
            fetchNotebookName(data.blog.evernoteNotebook)
          }
        } else {
          console.log('Blog has no evernoteNotebook')
        }
        
        // Fetch detailed post statistics
        fetchPostStats()
      } else {
        alert('Blog not found')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error fetching blog:', error)
      alert('Failed to load blog')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [blogId, router, fetchNotebookName, fetchPostStats])


  const fetchUserBlogSpace = useCallback(async () => {
    try {
      const response = await fetch('/api/user/blog-space')
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setUserBlogSpace(data.user)
        }
      }
    } catch (error) {
      console.error('Error fetching user blog space:', error)
    }
  }, [])

  useEffect(() => {
    // Check URL parameters for Evernote bypass mode (same as dashboard)
    const urlParams = new URLSearchParams(window.location.search)
    const evernoteBypass = urlParams.get('evernote_bypass') === 'true'
    
    // Check if we're in force auth mode (no NextAuth session required)
    const isForceAuth = sessionStorage.getItem('forceAuth') === 'true' || evernoteBypass
    
    if (evernoteBypass) {
      console.log('Evernote bypass mode detected in blog edit page')
      // Try to restore session like the dashboard does
      const restoreSession = async () => {
        try {
          const response = await fetch('/api/auth/create-session', { method: 'POST' })
          const result = await response.json()
          
          if (result.success) {
            console.log('Session restored for blog edit page')
            setTimeout(() => fetchBlog(), 1000)
          } else {
            console.log('Session restoration failed, loading blog anyway')
            fetchBlog()
          }
        } catch (error) {
          console.error('Session restoration error:', error)
          fetchBlog()
        }
      }
      
      restoreSession()
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }
    
    if (!isForceAuth && status === 'unauthenticated') {
      router.push('/auth/signin')
    } else if ((isForceAuth || status === 'authenticated') && blogId) {
      fetchBlog()
      fetchUserBlogSpace()
    }
  }, [status, router, blogId, fetchBlog, fetchUserBlogSpace])

  // Check domain status when custom domain changes
  useEffect(() => {
    if (blogCustomDomain && urlFormat === 'custom') {
      checkDomainStatus()
    } else {
      setDomainStatus(null)
    }
  }, [blogCustomDomain, urlFormat]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNotebooks = async () => {
    try {
      const response = await fetch('/api/evernote/notebooks')
      if (response.ok) {
        const data = await response.json()
        setNotebooks(data.notebooks)
        setShowNotebooks(true)
      } else {
        alert('Failed to fetch notebooks. Please make sure you are connected to Evernote.')
      }
    } catch (error) {
      console.error('Error fetching notebooks:', error)
      alert('Failed to fetch notebooks.')
    }
  }

  const connectNotebook = async (notebookGuid: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          isPublic,
          evernoteNotebook: notebookGuid,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setBlog(data.blog)
        setShowNotebooks(false)
        // Find and set the notebook name
        const selectedNotebook = notebooks.find(nb => nb.guid === notebookGuid)
        if (selectedNotebook) {
          setNotebookName(selectedNotebook.name)
        }
        alert('Notebook connected successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to connect notebook')
      }
    } catch (error) {
      console.error('Error connecting notebook:', error)
      alert('Failed to connect notebook. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const disconnectNotebook = async () => {
    if (!confirm('Are you sure you want to disconnect this notebook? Posts will remain but won\'t sync anymore.')) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          isPublic,
          evernoteNotebook: null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setBlog(data.blog)
        setNotebookName(null)
        alert('Notebook disconnected successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to disconnect notebook')
      }
    } catch (error) {
      console.error('Error disconnecting notebook:', error)
      alert('Failed to disconnect notebook. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const resetSyncState = async () => {
    if (!confirm('Reset sync state for this blog? This will force a fresh sync on next attempt.')) {
      return
    }

    setResettingSync(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}/reset-sync`, { method: 'POST' })
      const data = await response.json()
      
      if (response.ok && data.success) {
        await fetchBlog() // Refresh blog data
        fetchPostStats() // Refresh post statistics
        alert('Sync state reset successfully. Next sync will be a fresh full sync.')
      } else {
        alert(data.error || 'Failed to reset sync state')
      }
    } catch (error) {
      console.error('Error resetting sync state:', error)
      alert('Failed to reset sync state. Please try again.')
    } finally {
      setResettingSync(false)
    }
  }

  const syncNow = async () => {
    // Prevent multiple concurrent syncs
    if (syncing) {
      console.log('Sync already in progress, ignoring click')
      return
    }
    
    setSyncing(true)
    setShowSyncResults(false)
    try {
      const response = await fetch(`/api/blogs/${blogId}/sync`, { method: 'POST' })
      const data = await response.json()
      
      if (response.ok && data.success) {
        setSyncResults({
          success: true,
          results: [{
            blogId: blogId,
            blogTitle: blog?.title || '',
            notesFound: data.result.notesFound || 0,
            newPosts: data.result.newPosts || 0,
            updatedPosts: data.result.updatedPosts || 0,
            unpublishedPosts: data.result.unpublishedPosts || 0,
            republishedPosts: data.result.republishedPosts || 0,
            republishedUpdatedPosts: data.result.republishedUpdatedPosts || 0,
            totalPublishedPosts: data.result.totalPublishedPosts || 0,
            posts: data.result.posts || []
          }],
          totalNewPosts: data.result.newPosts || 0,
          totalUpdatedPosts: data.result.updatedPosts || 0,
          totalUnpublishedPosts: data.result.unpublishedPosts || 0,
          totalRepublishedPosts: data.result.republishedPosts || 0,
          totalRepublishedUpdatedPosts: data.result.republishedUpdatedPosts || 0
        })
        setShowSyncResults(true)
        // Refresh blog data to show updated post count
        fetchBlog()
      } else {
        // Handle both error responses and failed success responses
        const errorMessage = data.error || 'Unknown error'
        if (response.status === 429) {
          // Rate limit error - show specific message
          alert(`Rate limit exceeded: ${errorMessage}`)
        } else {
          alert(`Sync failed: ${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Error syncing:', error)
      alert('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  const addCustomDomain = async () => {
    if (!blogCustomDomain.trim()) {
      alert('Please enter a domain name.')
      return
    }

    setAddingDomain(true)
    try {
      const response = await fetch('/api/domains/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: blogCustomDomain.trim(),
          blogId: blogId
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        await fetchBlog() // Refresh blog data
        await checkDomainStatus() // Check verification status
        alert('Domain added successfully! Please check DNS requirements below.')
      } else {
        alert(data.error || 'Failed to add domain')
      }
    } catch (error) {
      console.error('Error adding domain:', error)
      alert('Failed to add domain. Please try again.')
    } finally {
      setAddingDomain(false)
    }
  }

  const removeCustomDomain = async () => {
    if (!confirm('Are you sure you want to remove the custom domain? Your blog will revert to path-based URLs.')) {
      return
    }

    setRemovingDomain(true)
    try {
      const response = await fetch('/api/domains/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogId: blogId })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        await fetchBlog() // Refresh blog data
        setDomainStatus(null)
        setBlogCustomDomain('')
        setUrlFormat('path')
        alert('Custom domain removed successfully.')
      } else {
        alert(data.error || 'Failed to remove domain')
      }
    } catch (error) {
      console.error('Error removing domain:', error)
      alert('Failed to remove domain. Please try again.')
    } finally {
      setRemovingDomain(false)
    }
  }

  const checkDomainStatus = async () => {
    if (!blogCustomDomain.trim()) return

    // Only check status if domain is already added to the blog
    if (blog?.customDomain !== blogCustomDomain.trim()) {
      setDomainStatus(null)
      return
    }

    setDomainStatus({ verified: false, checking: true })
    try {
      const response = await fetch(`/api/domains/status/${encodeURIComponent(blogCustomDomain.trim())}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setDomainStatus({
          verified: data.isValid,
          checking: false,
          error: data.isValid ? undefined : 'Domain not verified - please check DNS settings'
        })
      } else {
        setDomainStatus({
          verified: false,
          checking: false,
          error: data.error || 'Failed to check domain status'
        })
      }
    } catch (error) {
      console.error('Error checking domain status:', error)
      setDomainStatus({
        verified: false,
        checking: false,
        error: 'Failed to check domain status'
      })
    }
  }

  const verifyDomain = async () => {
    setDomainStatus(prev => prev ? { ...prev, checking: true } : { verified: false, checking: true })
    setVerificationReport(null)
    
    try {
      const response = await fetch('/api/domains/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogId: blogId })
      })

      const data = await response.json()

      if (response.ok) {
        // Store the detailed verification report
        setVerificationReport(data)
        setShowVerificationReport(true)
        
        setDomainStatus({
          verified: data.verified || false,
          checking: false,
          error: data.verified ? undefined : 'Domain verification pending - see report for details'
        })
      } else {
        setDomainStatus({
          verified: false,
          checking: false,
          error: data.error || 'Verification failed'
        })
        
        // Even for errors, show the report if available
        if (data.checks || data.recommendations) {
          setVerificationReport(data)
          setShowVerificationReport(true)
        }
      }
    } catch (error) {
      console.error('Error verifying domain:', error)
      setDomainStatus({
        verified: false,
        checking: false,
        error: 'Failed to verify domain'
      })
    }
  }

  const handleSave = async () => {
    // Build object with only changed fields
    const changes: { title?: string; description?: string; author?: string; isPublic?: boolean; theme?: string; showCameraMake?: boolean; urlFormat?: string; subdomain?: string; customDomain?: string } = {}
    
    if (title !== originalTitle) {
      changes.title = title
    }
    if (description !== originalDescription) {
      changes.description = description
    }
    if (author !== originalAuthor) {
      changes.author = author
    }
    if (isPublic !== originalIsPublic) {
      changes.isPublic = isPublic
    }
    if (theme !== originalTheme) {
      changes.theme = theme
    }
    if (showCameraMake !== originalShowCameraMake) {
      changes.showCameraMake = showCameraMake
    }
    if (urlFormat !== originalUrlFormat) {
      changes.urlFormat = urlFormat
    }
    if (blogSubdomain !== originalBlogSubdomain) {
      changes.subdomain = blogSubdomain
    }
    if (blogCustomDomain !== originalBlogCustomDomain) {
      changes.customDomain = blogCustomDomain
    }

    // Validate URL format requirements
    if (urlFormat === 'subdomain' && !blogSubdomain.trim()) {
      alert('Please enter a subdomain name for subdomain URLs.')
      return
    }
    
    if (urlFormat === 'custom' && !blogCustomDomain.trim()) {
      alert('Please enter a custom domain for custom domain URLs.')
      return
    }

    // Check if any changes were made
    if (Object.keys(changes).length === 0) {
      alert('No changes made.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changes),
      })

      if (response.ok) {
        const data = await response.json()
        setBlog(data.blog)
        
        // Update original values after successful save
        setOriginalTitle(title)
        setOriginalDescription(description)
        setOriginalAuthor(author)
        setOriginalIsPublic(isPublic)
        setOriginalTheme(theme)
        setOriginalShowCameraMake(showCameraMake)
        setOriginalUrlFormat(urlFormat)
        setOriginalBlogSubdomain(blogSubdomain)
        setOriginalBlogCustomDomain(blogCustomDomain)
        
        alert('Blog updated successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to update blog')
      }
    } catch (error) {
      console.error('Error updating blog:', error)
      alert('Failed to update blog. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!blog) return

    if (!confirm(`Are you sure you want to delete "${blog.title}"? This action cannot be undone and will delete all posts in this blog.`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/blogs/${blogId}`, { method: 'DELETE' })
      if (response.ok) {
        alert('Blog deleted successfully!')
        router.push('/dashboard')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to delete blog')
      }
    } catch (error) {
      console.error('Error deleting blog:', error)
      alert('Failed to delete blog. Please try again.')
    } finally {
      setDeleting(false)
    }
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

  if (!blog) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Blog Settings</h1>
              <p className="text-black font-semibold mt-1" style={{color: '#000000'}}>{blog.title}</p>
            </div>
            <div className="flex items-center space-x-4">
              {userBlogSpace ? (
                <div className="flex items-center space-x-2">
                  <a
                    href={getBlogUrl(blog, userBlogSpace.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    View Blog
                  </a>
                  <span className="text-xs text-gray-500">
                    ({blog.urlFormat || 'path'})
                  </span>
                </div>
              ) : (
                <span className="bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed">
                  Loading...
                </span>
              )}
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Blog Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">General Settings</h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="title" className="block text-sm font-medium text-black">
                    Blog Title
                  </label>
                  
                  {/* Auto-save status indicator */}
                  <div className="flex items-center space-x-2">
                    {autoSaving.title && (
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                        <span>Saving...</span>
                      </div>
                    )}
                    {autoSaveSuccess.title && (
                      <div className="flex items-center space-x-1 text-xs text-green-600">
                        <span>✓</span>
                        <span>Saved</span>
                      </div>
                    )}
                    {autoSaveError.title && (
                      <div className="flex items-center space-x-1 text-xs text-red-600">
                        <span>✗</span>
                        <span>{autoSaveError.title}</span>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setTitle(newValue)
                    debouncedAutoSave('title', newValue)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="description" className="block text-sm font-medium text-black">
                    Subtitle
                  </label>
                  
                  {/* Auto-save status indicator */}
                  <div className="flex items-center space-x-2">
                    {autoSaving.description && (
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                        <span>Saving...</span>
                      </div>
                    )}
                    {autoSaveSuccess.description && (
                      <div className="flex items-center space-x-1 text-xs text-green-600">
                        <span>✓</span>
                        <span>Saved</span>
                      </div>
                    )}
                    {autoSaveError.description && (
                      <div className="flex items-center space-x-1 text-xs text-red-600">
                        <span>✗</span>
                        <span>{autoSaveError.description}</span>
                      </div>
                    )}
                  </div>
                </div>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setDescription(newValue)
                    debouncedAutoSave('description', newValue)
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  placeholder="Optional subtitle displayed under the blog name"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="author" className="block text-sm font-medium text-black">
                    Author
                  </label>
                  
                  {/* Auto-save status indicator */}
                  <div className="flex items-center space-x-2">
                    {autoSaving.author && (
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                        <span>Saving...</span>
                      </div>
                    )}
                    {autoSaveSuccess.author && (
                      <div className="flex items-center space-x-1 text-xs text-green-600">
                        <span>✓</span>
                        <span>Saved</span>
                      </div>
                    )}
                    {autoSaveError.author && (
                      <div className="flex items-center space-x-1 text-xs text-red-600">
                        <span>✗</span>
                        <span>{autoSaveError.author}</span>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  id="author"
                  value={author}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setAuthor(newValue)
                    debouncedAutoSave('author', newValue)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  placeholder="Author name for byline"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => {
                      const newValue = e.target.checked
                      setIsPublic(newValue)
                      autoSaveField('isPublic', newValue)
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isPublic" className="ml-2 block text-sm text-black">
                    Make this blog public
                  </label>
                </div>
                
                {/* Auto-save status indicator */}
                <div className="flex items-center space-x-2">
                  {autoSaving.isPublic && (
                    <div className="flex items-center space-x-1 text-xs text-gray-600">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                      <span>Saving...</span>
                    </div>
                  )}
                  {autoSaveSuccess.isPublic && (
                    <div className="flex items-center space-x-1 text-xs text-green-600">
                      <span>✓</span>
                      <span>Saved</span>
                    </div>
                  )}
                  {autoSaveError.isPublic && (
                    <div className="flex items-center space-x-1 text-xs text-red-600">
                      <span>✗</span>
                      <span>{autoSaveError.isPublic}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="theme" className="block text-sm font-medium text-black">
                    Theme
                  </label>
                  
                  {/* Auto-save status indicator */}
                  <div className="flex items-center space-x-2">
                    {autoSaving.theme && (
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                        <span>Saving...</span>
                      </div>
                    )}
                    {autoSaveSuccess.theme && (
                      <div className="flex items-center space-x-1 text-xs text-green-600">
                        <span>✓</span>
                        <span>Saved</span>
                      </div>
                    )}
                    {autoSaveError.theme && (
                      <div className="flex items-center space-x-1 text-xs text-red-600">
                        <span>✗</span>
                        <span>{autoSaveError.theme}</span>
                      </div>
                    )}
                  </div>
                </div>
                <select
                  id="theme"
                  value={theme}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setTheme(newValue)
                    autoSaveField('theme', newValue)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                >
                  {getAvailableThemes().map((availableTheme) => (
                    <option key={availableTheme.id} value={availableTheme.id}>
                      {availableTheme.name} - {availableTheme.description}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex items-center space-x-2">
                  <a
                    href={`/blog/${blog?.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Preview current theme →
                  </a>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-black mb-4">Image Settings</h3>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="showCameraMake"
                      checked={showCameraMake}
                      onChange={(e) => {
                        const newValue = e.target.checked
                        setShowCameraMake(newValue)
                        autoSaveField('showCameraMake', newValue)
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="showCameraMake" className="ml-2 block text-sm text-black">
                      Show camera make in image captions
                    </label>
                  </div>
                  
                  {/* Auto-save status indicator */}
                  <div className="flex items-center space-x-2">
                    {autoSaving.showCameraMake && (
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                        <span>Saving...</span>
                      </div>
                    )}
                    {autoSaveSuccess.showCameraMake && (
                      <div className="flex items-center space-x-1 text-xs text-green-600">
                        <span>✓</span>
                        <span>Saved</span>
                      </div>
                    )}
                    {autoSaveError.showCameraMake && (
                      <div className="flex items-center space-x-1 text-xs text-red-600">
                        <span>✗</span>
                        <span>{autoSaveError.showCameraMake}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  When enabled, image captions will show both camera make and model (e.g., &quot;Leica Camera AG LEICA M&quot;). When disabled, only the camera model will be shown (e.g., &quot;LEICA M&quot;).
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-black mb-4">URL Format</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="pathUrls"
                        name="urlFormat"
                        checked={urlFormat === 'path'}
                        onChange={() => setUrlFormat('path')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="pathUrls" className="ml-2 block text-sm text-black">
                        Use path-based URLs (default)
                      </label>
                    </div>
                    <div className="ml-6 text-sm text-gray-600 mt-1">
                      Example: <code className="bg-gray-100 px-2 py-1 rounded">from.cafe/username/{blog?.slug}</code>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="subdomainUrls"
                        name="urlFormat"
                        checked={urlFormat === 'subdomain'}
                        onChange={() => setUrlFormat('subdomain')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="subdomainUrls" className="ml-2 block text-sm text-black">
                        Use subdomain URLs
                      </label>
                    </div>
                    <div className="ml-6 mt-2">
                      <input
                        type="text"
                        placeholder="subdomain"
                        value={blogSubdomain}
                        onChange={(e) => setBlogSubdomain(e.target.value)}
                        className="w-40 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-sm"
                        disabled={urlFormat !== 'subdomain'}
                      />
                      <span className="text-sm text-gray-600">.from.cafe</span>
                      <div className="text-sm text-gray-600 mt-1">
                        Example: <code className="bg-gray-100 px-2 py-1 rounded">{blogSubdomain || 'subdomain'}.from.cafe</code>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="customDomainUrls"
                        name="urlFormat"
                        checked={urlFormat === 'custom'}
                        onChange={() => setUrlFormat('custom')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="customDomainUrls" className="ml-2 block text-sm text-black">
                        Use custom domain
                      </label>
                    </div>
                    <div className="ml-6 mt-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="yourdomain.com"
                          value={blogCustomDomain}
                          onChange={(e) => setBlogCustomDomain(e.target.value)}
                          className="w-60 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-sm"
                          disabled={urlFormat !== 'custom'}
                        />
                        {urlFormat === 'custom' && blogCustomDomain && (
                          <>
                            {blog?.customDomain === blogCustomDomain.trim() ? (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={verifyDomain}
                                  disabled={domainStatus?.checking || saving}
                                  className="bg-blue-600 text-white px-3 py-1 text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {domainStatus?.checking ? 'Checking...' : 'Verify'}
                                </button>
                                <button
                                  onClick={removeCustomDomain}
                                  disabled={removingDomain || saving}
                                  className="bg-red-600 text-white px-3 py-1 text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  {removingDomain ? 'Removing...' : 'Remove'}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={addCustomDomain}
                                disabled={addingDomain || saving}
                                className="bg-green-600 text-white px-3 py-1 text-xs rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {addingDomain ? 'Adding...' : 'Add Domain'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      
                      {/* Domain Status */}
                      {urlFormat === 'custom' && domainStatus && domainStatus.verified !== undefined ? (
                        <div className={`mt-2 p-2 rounded text-sm ${
                          domainStatus.verified 
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : domainStatus.error
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                        }`}>
                          <div className="flex items-center space-x-2">
                            {domainStatus.checking ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                            ) : domainStatus.verified ? (
                              <span>✅</span>
                            ) : (
                              <span>⚠️</span>
                            )}
                            <span>
                              {domainStatus.checking 
                                ? 'Checking domain status...'
                                : domainStatus.verified 
                                ? 'Domain verified and active'
                                : domainStatus.error || 'Domain not verified'
                              }
                            </span>
                          </div>
                        </div>
                      ) : null}
                      
                      {/* Detailed Verification Report */}
                      {verificationReport && showVerificationReport && (
                        <div className="mt-4 border border-gray-200 rounded-lg">
                          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                            <h4 className="font-semibold text-gray-900">Domain Verification Report</h4>
                            <button
                              onClick={() => setShowVerificationReport(false)}
                              className="text-gray-500 hover:text-gray-700 text-sm"
                            >
                              ✕ Close
                            </button>
                          </div>
                          
                          <div className="p-4 space-y-4">
                            <div className="text-sm text-gray-600">
                              <strong>Domain:</strong> {verificationReport.domain} 
                              <span className="ml-2 text-xs text-gray-500">
                                Checked at {new Date(verificationReport.timestamp || '').toLocaleString()}
                              </span>
                            </div>
                            
                            {/* Verification Checks */}
                            <div className="space-y-3">
                              <h5 className="font-medium text-gray-900">Verification Checks:</h5>
                              
                              {verificationReport.checks && Object.entries(verificationReport.checks).map(([checkName, check]) => (
                                <div key={checkName} className="flex items-start space-x-3">
                                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    check.status === 'pass' ? 'bg-green-100 text-green-800' :
                                    check.status === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗'}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-sm capitalize text-gray-900">
                                      {checkName.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                      {check.message}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Recommendations */}
                            {verificationReport.recommendations && verificationReport.recommendations.length > 0 && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <h5 className="font-medium text-blue-900 mb-2">💡 Recommendations:</h5>
                                <ul className="text-sm text-blue-800 space-y-1">
                                  {verificationReport.recommendations.map((rec: string, idx: number) => (
                                    <li key={idx} className="flex items-start space-x-2">
                                      <span className="text-blue-500 mt-0.5">•</span>
                                      <span>{rec}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Overall Status */}
                            <div className={`p-3 rounded-lg border ${
                              verificationReport.success && verificationReport.verified 
                                ? 'bg-green-50 border-green-200' 
                                : verificationReport.success 
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <div className={`font-medium ${
                                verificationReport.success && verificationReport.verified 
                                  ? 'text-green-800' 
                                  : verificationReport.success 
                                  ? 'text-yellow-800'
                                  : 'text-red-800'
                              }`}>
                                {verificationReport.success && verificationReport.verified 
                                  ? '🎉 Domain is fully verified and working!'
                                  : verificationReport.success 
                                  ? '⏳ Domain configuration looks good, verification pending'
                                  : '❌ Domain verification failed - please check configuration'
                                }
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                              <button
                                onClick={verifyDomain}
                                disabled={domainStatus?.checking}
                                className="bg-blue-600 text-white px-4 py-2 text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {domainStatus?.checking ? 'Re-checking...' : 'Re-run Verification'}
                              </button>
                              
                              <div className="text-xs text-gray-500">
                                Next verification will check all settings again
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="text-sm text-gray-600 mt-1">
                        Example: <code className="bg-gray-100 px-2 py-1 rounded">{blogCustomDomain || 'yourdomain.com'}</code>
                      </div>
                      {urlFormat === 'custom' && (
                        <div className="text-xs text-blue-600 mt-1">
                          <a href="/site/domains" target="_blank" rel="noopener noreferrer" className="underline">
                            📖 View DNS setup instructions
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                
                <button
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Blog'}
                </button>
              </div>
            </div>
          </div>

          {/* Blog Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Blog Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Current Blog URL</label>
                {userBlogSpace ? (
                  <div className="space-y-2">
                    <div className="text-sm">
                      <div className="flex items-center space-x-2">
                        {((urlFormat === 'subdomain' && !blogSubdomain.trim()) || 
                          (urlFormat === 'custom' && !blogCustomDomain.trim())) ? (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        ) : (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                        <span className="font-medium text-black">
                          Active URL ({urlFormat} format)
                          {((urlFormat === 'subdomain' && !blogSubdomain.trim()) || 
                            (urlFormat === 'custom' && !blogCustomDomain.trim())) && (
                            <span className="text-yellow-600 ml-1">- Incomplete</span>
                          )}
                        </span>
                      </div>
                      <div className="ml-4 text-black font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-1">
                        {getPreviewUrl(urlFormat, blogSubdomain, blogCustomDomain, blog.slug, userBlogSpace.slug)}
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2">
                      URL format can be changed in the settings below
                    </div>
                  </div>
                ) : (
                  <p className="text-black">Loading...</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Posts</label>
                {postStats ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 p-3 rounded">
                        <div className="text-lg font-bold text-green-900">{postStats.published}</div>
                        <div className="text-sm text-green-700">Published</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="text-lg font-bold text-gray-900">{postStats.unpublished}</div>
                        <div className="text-sm text-gray-700">Unpublished</div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mt-2">
                      <div className="flex justify-between">
                        <span>Evernote posts:</span>
                        <span>{postStats.publishedEvernoteCount} published, {postStats.unpublishedEvernoteCount} unpublished</span>
                      </div>
                      {postStats.ghostCount > 0 && (
                        <div className="flex justify-between mt-1">
                          <span>Ghost posts:</span>
                          <span>{postStats.publishedGhostCount} published, {postStats.unpublishedGhostCount} unpublished</span>
                        </div>
                      )}
                      <div className="flex justify-between mt-1 font-medium">
                        <span>Total posts:</span>
                        <span>{postStats.totalCount}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                    <span className="text-gray-600">Loading post statistics...</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Status</label>
                <p className="text-black">{blog.isPublic ? 'Public' : 'Private'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Evernote Notebook</label>
                {blog.evernoteNotebook ? (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-black">Connected to {notebookName || 'Evernote notebook'}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={syncNow}
                        disabled={syncing || saving || resettingSync}
                        className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {syncing ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        onClick={resetSyncState}
                        disabled={syncing || saving || resettingSync}
                        className="bg-yellow-600 text-white px-3 py-1 text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                        title="Reset sync state to force fresh sync"
                      >
                        {resettingSync ? 'Resetting...' : 'Reset Sync'}
                      </button>
                      <button
                        onClick={disconnectNotebook}
                        disabled={saving || syncing || resettingSync}
                        className="bg-red-600 text-white px-3 py-1 text-sm rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </div>
                    <p className="text-sm text-black mt-2">
                      Syncs notes with &quot;published&quot; tag from your Evernote notebook
                    </p>
                    
                    {/* Sync Endpoint Configuration */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <label className="text-sm font-medium text-black">External Sync Endpoint</label>
                          <p className="text-xs text-gray-600">Allow external services to trigger sync</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={enableSyncEndpoint}
                            onChange={(e) => handleSyncEndpointToggle(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          {autoSaving.enableSyncEndpoint && (
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                          )}
                          {autoSaveSuccess.enableSyncEndpoint && (
                            <span className="text-xs text-green-600">✓</span>
                          )}
                        </div>
                      </div>
                      
                      {enableSyncEndpoint && syncEndpointPassword && (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <code className="text-xs bg-white px-2 py-1 rounded border font-mono text-gray-800 flex-1">
                              {window.location.origin}/api/blogs/{blog.id}/sync-external?password={syncEndpointPassword}
                            </code>
                            <button
                              onClick={copySyncEndpointUrl}
                              className="bg-blue-600 text-white px-2 py-1 text-xs rounded hover:bg-blue-700"
                              title="Copy to clipboard"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-xs text-gray-600">
                            Use with external cron services like cron-job.org or GitHub Actions
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="text-black">Not connected</span>
                    </div>
                    <button
                      onClick={fetchNotebooks}
                      disabled={saving}
                      className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Connect Notebook
                    </button>
                    <p className="text-sm text-black mt-2">
                      Connect an Evernote notebook to automatically sync notes as blog posts
                    </p>
                  </div>
                )}
              </div>

              {/* Sync Status */}
              {blog.evernoteNotebook && (
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Sync Status</label>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-black">Last successful sync: </span>
                      <span className="text-sm text-black font-medium">
                        {blog.lastSyncedAt ? formatTimeAgo(blog.lastSyncedAt) : 'Never'}
                      </span>
                    </div>
                    {blog.lastSyncAttemptAt && blog.lastSyncAttemptAt !== blog.lastSyncedAt && (
                      <div>
                        <span className="text-sm text-black">Last attempt: </span>
                        <span className="text-sm text-red-600 font-medium">
                          {formatTimeAgo(blog.lastSyncAttemptAt)} (failed)
                        </span>
                      </div>
                    )}
                    {blog.lastSyncUpdateCount && (
                      <div className="text-xs text-black opacity-60">
                        Sync state: {blog.lastSyncUpdateCount}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ghost Configuration */}
              <div>
                <label className="block text-sm font-medium text-black mb-1">Ghost Integration</label>
                <GhostConfigSection blogId={blogId} />
              </div>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          <p>
            <strong>🎉 Blog created successfully!</strong>
          </p>
          <p className="text-sm mt-1">
            {blog.evernoteNotebook 
              ? "Your blog is now connected to your Evernote notebook and will automatically sync new posts."
              : "You can now start creating posts for your blog."
            }
          </p>
        </div>
      </main>

      {/* Notebook Selection Modal */}
      {showNotebooks && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-black">Select Notebook</h3>
                <button
                  onClick={() => setShowNotebooks(false)}
                  className="text-black hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-black mb-4">
                Choose which Evernote notebook to connect to this blog:
              </p>
              <div className="space-y-2">
                {notebooks.map((notebook) => (
                  <button
                    key={notebook.guid}
                    onClick={() => connectNotebook(notebook.guid)}
                    disabled={saving}
                    className="w-full text-left p-3 border border-gray-200 rounded hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <span className="font-medium text-black">{notebook.name}</span>
                  </button>
                ))}
              </div>
              {notebooks.length === 0 && (
                <p className="text-black text-center py-4">No notebooks found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync Results Modal */}
      {showSyncResults && syncResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-black">Sync Results</h3>
                <button
                  onClick={() => setShowSyncResults(false)}
                  className="text-black hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4">
                <h4 className="font-medium text-black mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-green-800 font-medium">New Posts</div>
                    <div className="text-green-600 text-lg">{syncResults.totalNewPosts}</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-blue-800 font-medium">Updated Posts</div>
                    <div className="text-blue-600 text-lg">{syncResults.totalUpdatedPosts}</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded">
                    <div className="text-red-800 font-medium">Unpublished Posts</div>
                    <div className="text-red-600 text-lg">{syncResults.totalUnpublishedPosts}</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="text-purple-800 font-medium">Republished Posts</div>
                    <div className="text-purple-600 text-lg">{(syncResults.totalRepublishedPosts || 0) + (syncResults.totalRepublishedUpdatedPosts || 0)}</div>
                  </div>
                </div>
              </div>

              {syncResults.results.map((result: { blogId: string; blogTitle: string; notesFound: number; totalPublishedPosts: number; posts: { isNew: boolean; isUpdated: boolean; isUnpublished: boolean; isRepublished?: boolean; isRepublishedUpdated?: boolean; title: string }[] }) => {
                const blogResult = result.blogId === blogId ? result : null
                if (!blogResult) return null
                
                return (
                  <div key={result.blogId} className="mb-4">
                    <h4 className="font-medium text-black mb-2">{result.blogTitle}</h4>
                    <div className="text-sm text-black mb-2">
                      Found {result.notesFound} notes • {result.totalPublishedPosts} total published posts
                    </div>
                    
                    {result.posts.length > 0 && (
                      <div className="space-y-2">
                        {result.posts.map((post: { isNew: boolean; isUpdated: boolean; isUnpublished: boolean; isRepublished?: boolean; isRepublishedUpdated?: boolean; title: string }, index: number) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            {post.isNew && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">NEW</span>}
                            {post.isUpdated && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">UPDATED</span>}
                            {post.isRepublishedUpdated && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">REPUBLISHED+UPDATED</span>}
                            {post.isRepublished && !post.isRepublishedUpdated && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">REPUBLISHED</span>}
                            {post.isUnpublished && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">UNPUBLISHED</span>}
                            {post.title.startsWith('Error:') && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">ERROR</span>}
                            {post.title.startsWith('Sync failed:') && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">FAILED</span>}
                            <span className={post.title.startsWith('Error:') || post.title.startsWith('Sync failed:') ? 'text-red-600' : 'text-black'}>{post.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {result.posts.length === 0 && (
                      <div className="text-gray-500 text-sm">No changes made</div>
                    )}
                  </div>
                )
              })}
              
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => setShowSyncResults(false)}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}