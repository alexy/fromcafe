'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'

export default function EvernoteSuccessPage() {
  const router = useRouter()
  const [clicked, setClicked] = useState(false)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    const createSession = async () => {
      console.log('Creating manual NextAuth session after Evernote OAuth')
      
      try {
        // Check if we already have a valid session
        const currentSession = await getSession()
        console.log('Current session check:', !!currentSession)
        
        if (currentSession) {
          console.log('Session already exists, proceeding to dashboard')
          setRestoring(false)
          return
        }
        
        // Create manual session using custom endpoint
        console.log('No session found, creating manual session')
        const response = await fetch('/api/auth/create-session', { method: 'POST' })
        const result = await response.json()
        
        console.log('Manual session creation result:', result)
        
        if (result.success) {
          console.log('Manual session created successfully')
          // Force NextAuth to refresh and pick up the new session
          setTimeout(async () => {
            await getSession()
            setRestoring(false)
          }, 1000)
        } else {
          console.error('Manual session creation failed:', result.error)
          setRestoring(false)
        }
        
      } catch (error) {
        console.error('Session creation error:', error)
        setRestoring(false)
      }
    }
    
    createSession()
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