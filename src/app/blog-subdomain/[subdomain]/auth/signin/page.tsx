import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getPrimaryDomain } from '@/config/domains'

interface SubdomainSignInPageProps {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function SubdomainSignInPage({ searchParams }: SubdomainSignInPageProps) {
  const { callbackUrl } = await searchParams
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  console.log('🔑 Subdomain auth page:', { hostname, callbackUrl })
  
  // Check if user is already signed in
  const session = await getServerSession(authOptions)
  console.log('🔑 Subdomain auth - Session check:', { 
    hasSession: !!session, 
    hasUser: !!session?.user, 
    userId: session?.user?.id 
  })
  
  if (session?.user?.id) {
    console.log('🔑 User already authenticated, redirecting to callback')
    // If they have a callback URL, redirect there, otherwise go to the blog
    const redirectUrl = callbackUrl || `https://${hostname}/`
    redirect(redirectUrl)
  }
  
  console.log('🔑 No session, redirecting to main domain auth')
  // Redirect to main domain auth with callback URL that brings them back to subdomain
  const mainDomainCallback = callbackUrl 
    ? `https://${hostname}${callbackUrl}`
    : `https://${hostname}/`
    
  redirect(`https://${getPrimaryDomain()}/auth/signin?callbackUrl=${encodeURIComponent(mainDomainCallback)}`)
}