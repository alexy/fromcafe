'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EvernoteSuccessPage() {
  const router = useRouter()
  const [clicked, setClicked] = useState(false)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    const handlePostOAuth = async () => {
      console.log('Handling post-Evernote OAuth flow')
      
      try {
        // Skip session creation entirely and go directly to dashboard
        // We'll rely on the API endpoints to handle authentication server-side
        console.log('Bypassing NextAuth session creation, proceeding to dashboard')
        
        // Add a flag to localStorage to indicate we're in post-OAuth state
        localStorage.setItem('postEvernoteOAuth', 'true')
        localStorage.setItem('evernoteConnected', 'true')
        
        // Delay slightly to show the success message, then proceed
        setTimeout(() => {
          setRestoring(false)
        }, 2000)
        
      } catch (error) {
        console.error('Post-OAuth handling error:', error)
        setRestoring(false)
      }
    }
    
    handlePostOAuth()
  }, [])

  const handleContinue = () => {
    setClicked(true)
    router.push('/dashboard?success=evernote_connected')
  }

  if (restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">
              ✅ Evernote Connected Successfully!
            </h2>
            <p className="mt-4 text-sm text-gray-600">
              Restoring your session...
            </p>
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          </div>
        </div>
      </div>
    )
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