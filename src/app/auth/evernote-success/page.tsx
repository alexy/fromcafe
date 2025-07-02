'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EvernoteSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    // Small delay to let any session restoration happen naturally
    const timer = setTimeout(() => {
      router.push('/dashboard?success=evernote_connected')
    }, 500)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">
            ✅ Evernote Connected!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Taking you back to the dashboard...
          </p>
        </div>
      </div>
    </div>
  )
}