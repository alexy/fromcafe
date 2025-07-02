'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function EvernoteSuccessPage() {
  const router = useRouter()
  const [clicked, setClicked] = useState(false)
  const { update } = useSession()

  useEffect(() => {
    // Check if we need to refresh the session after Evernote OAuth
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('refresh_session') === 'true') {
      console.log('Refreshing session after Evernote OAuth using custom endpoint')
      
      // Use custom session refresh endpoint
      fetch('/api/auth/refresh-session', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          console.log('Session refresh result:', data)
          if (data.success && data.sessionValid) {
            console.log('Session refreshed successfully, triggering NextAuth update')
            update() // Now trigger NextAuth to pick up the refreshed session
          } else {
            console.error('Session refresh failed:', data.error)
          }
        })
        .catch(error => {
          console.error('Session refresh error:', error)
        })
      
      // Clean up URL
      window.history.replaceState({}, document.title, '/auth/evernote-success')
    }
  }, [update])

  const handleContinue = () => {
    setClicked(true)
    router.push('/dashboard?success=evernote_connected')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">
            ✅ Evernote Connected Successfully!
          </h2>
          <p className="mt-4 text-sm text-gray-600">
            Your Evernote account has been connected to your blog.
          </p>
          <button
            onClick={handleContinue}
            disabled={clicked}
            className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {clicked ? 'Loading...' : 'Continue to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  )
}