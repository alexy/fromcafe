'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Something went wrong during sign in
          </p>
        </div>
        
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-medium">Error Details:</p>
          <p className="text-sm mt-1">
            {error === 'Configuration' && 'There is a problem with the server configuration.'}
            {error === 'AccessDenied' && 'Access denied. You do not have permission to sign in.'}
            {error === 'Verification' && 'The verification token has expired or has already been used.'}
            {!['Configuration', 'AccessDenied', 'Verification'].includes(error || '') && 
              (error || 'Unknown authentication error occurred.')}
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/auth/signin"
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try Again
          </Link>
          
          <Link
            href="/"
            className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthErrorContent />
    </Suspense>
  )
}