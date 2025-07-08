import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getPrimaryDomain } from '@/config/domains'

interface CustomDomainSignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function CustomDomainSignInPage({ searchParams }: CustomDomainSignInPageProps) {
  const { callbackUrl } = await searchParams
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  
  // Check if user is already signed in
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    // If they have a callback URL, redirect there, otherwise go to the blog
    const redirectUrl = callbackUrl || `https://${hostname}/`
    redirect(redirectUrl)
  }
  
  // Redirect to main domain auth with callback URL that brings them back to custom domain
  const mainDomainCallback = callbackUrl 
    ? `https://${hostname}${callbackUrl}`
    : `https://${hostname}/`
    
  redirect(`https://${getPrimaryDomain()}/auth/signin?callbackUrl=${encodeURIComponent(mainDomainCallback)}`)
}