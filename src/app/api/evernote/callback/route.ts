import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEvernoteAccessToken } from '@/lib/evernote'

// Helper function to get the correct base URL for redirects
function getBaseUrl(): string {
  // Use NEXTAUTH_URL if explicitly set (for production override)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  
  // For Vercel deployments, use actual VERCEL_URL
  if (process.env.VERCEL && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Local development fallback
  return 'http://localhost:3000'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // Try both session methods for better reliability
  const session = await getServerSession(authOptions)
  const token = await getToken({ req: request })
  
  // Extract OAuth parameters first
  const oauthToken = searchParams.get('oauth_token')
  const oauthVerifier = searchParams.get('oauth_verifier')
  const edamNoteStoreUrl = searchParams.get('edam_noteStoreUrl')
  
  console.log('OAuth callback authentication:', {
    hasSession: !!session,
    sessionUserId: session?.user?.id,
    sessionUserEmail: session?.user?.email,
    hasToken: !!token,
    tokenSub: token?.sub,
    tokenEmail: token?.email,
    oauthToken: oauthToken ? 'present' : 'missing',
    oauthVerifier: oauthVerifier ? 'present' : 'missing',
    cookies: request.headers.get('cookie') ? 'present' : 'missing'
  })
  
  // If no OAuth parameters, this is an invalid callback
  if (!oauthToken || !oauthVerifier) {
    console.log('Missing OAuth parameters, redirecting to dashboard with error')
    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL('/dashboard?error=invalid_oauth', baseUrl))
  }
  
  // Use either session or token for user identification
  const userId = session?.user?.id || token?.sub
  
  if (!userId) {
    console.log('No session or user ID, need to sign in first')
    const baseUrl = getBaseUrl()
    console.log('Using base URL for redirect:', baseUrl)
    
    // Store the OAuth parameters in URL params for after sign-in
    const signInUrl = new URL('/auth/signin', baseUrl)
    signInUrl.searchParams.set('callbackUrl', 
      `/api/evernote/callback?oauth_token=${oauthToken}&oauth_verifier=${oauthVerifier}${edamNoteStoreUrl ? `&edam_noteStoreUrl=${edamNoteStoreUrl}` : ''}`)
    
    console.log('Redirecting to sign-in with callback URL to resume Evernote OAuth')
    return NextResponse.redirect(signInUrl)
  }

  console.log('OAuth callback parameters validated:', {
    oauthToken: oauthToken ? 'present' : 'missing',
    oauthVerifier: oauthVerifier ? 'present' : 'missing',
    edamNoteStoreUrl: edamNoteStoreUrl || 'not provided'
  })

  try {
    // Exchange the OAuth verifier for an access token
    console.log('Exchanging OAuth verifier for access token...')
    const { token: accessToken, noteStoreUrl } = await getEvernoteAccessToken(oauthToken, oauthVerifier)
    console.log('Access token received, length:', accessToken?.length)
    console.log('NoteStore URL from access token response:', noteStoreUrl)
    
    // Use noteStoreUrl from access token response if available, otherwise use the one from callback URL
    const finalNoteStoreUrl = noteStoreUrl || edamNoteStoreUrl
    console.log('Final noteStore URL to store:', finalNoteStoreUrl)
    
    // First check if user exists
    console.log('Checking if user exists...')
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    })
    
    const userEmail = session?.user?.email || token?.email
    const userName = session?.user?.name || token?.name
    const userImage = session?.user?.image || token?.picture
    
    if (!existingUser) {
      console.log('User not found in database, creating user...')
      // Create the user if they don't exist
      await prisma.user.create({
        data: {
          id: userId,
          email: userEmail!,
          name: userName,
          image: userImage,
          evernoteToken: accessToken,
          evernoteUserId: userId,
          evernoteNoteStoreUrl: finalNoteStoreUrl,
        }
      })
    } else {
      console.log('User exists, updating with Evernote credentials...')
      // Store the access token and noteStore URL in the database
      await prisma.user.update({
        where: { id: userId },
        data: {
          evernoteToken: accessToken,
          evernoteUserId: userId,
          evernoteNoteStoreUrl: finalNoteStoreUrl,
        },
      })
    }

    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL('/dashboard?success=evernote_connected', baseUrl))
  } catch (error) {
    console.error('Error completing Evernote OAuth:', error)
    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL('/dashboard?error=connection_failed', baseUrl))
  }
}