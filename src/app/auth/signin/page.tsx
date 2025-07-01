'use client'

import { signIn, getProviders } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function SignIn() {
  const [providers, setProviders] = useState<any>(null)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    const setUpProviders = async () => {
      const providersData = await getProviders()
      setProviders(providersData)
    }
    setUpProviders()
  }, [])

  if (!providers) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Evernote Blog
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Connect your Evernote account to create beautiful blogs
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error === 'OAuthSignin' && 'Error in constructing an authorization URL.'}
            {error === 'OAuthCallback' && 'Error in handling the response from an OAuth provider.'}
            {error === 'OAuthCreateAccount' && 'Could not create OAuth account.'}
            {error === 'EmailCreateAccount' && 'Could not create email account.'}
            {error === 'Callback' && 'Error in the OAuth callback handler route.'}
            {error === 'OAuthAccountNotLinked' && 'Another account with the same e-mail address exists.'}
            {error === 'EmailSignin' && 'Check your email address.'}
            {error === 'CredentialsSignin' && 'Sign in failed. Check the details you provided are correct.'}
            {error === 'SessionRequired' && 'Please sign in to access this page.'}
            {!['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'EmailCreateAccount', 'Callback', 'OAuthAccountNotLinked', 'EmailSignin', 'CredentialsSignin', 'SessionRequired'].includes(error) && 'An error occurred during sign in.'}
          </div>
        )}

        <div className="space-y-4">
          {Object.values(providers).map((provider: any) => (
            <div key={provider.name}>
              <button
                onClick={() => signIn(provider.id, { callbackUrl: '/dashboard' })}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in with {provider.name}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}