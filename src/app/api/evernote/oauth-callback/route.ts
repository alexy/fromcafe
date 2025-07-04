import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEvernoteAccessToken } from '@/lib/evernote'
import { jwtVerify } from 'jose'

// Helper function to get the correct base URL (prioritizes custom domain)
function getBaseUrl(): string {
  // Use NEXTAUTH_URL if explicitly set (this should be your custom domain)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  
  // For Vercel deployments, use VERCEL_URL as fallback
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
  
  // Extract OAuth parameters
  const oauthToken = searchParams.get('oauth_token')
  const oauthVerifier = searchParams.get('oauth_verifier')
  const edamNoteStoreUrl = searchParams.get('edam_noteStoreUrl')
  const userTokenFromUrl = searchParams.get('token')
  
  console.log('Evernote OAuth callback - checking authentication:', {
    hasSession: !!session,
    sessionUserId: session?.user?.id,
    sessionUserEmail: session?.user?.email,
    hasToken: !!token,
    tokenSub: token?.sub,
    tokenEmail: token?.email,
    userTokenFromUrl: userTokenFromUrl ? 'present' : 'not provided',
    oauthToken: oauthToken ? 'present' : 'missing',
    oauthVerifier: oauthVerifier ? 'present' : 'missing'
  })
  
  // If no OAuth parameters, this is an invalid callback
  if (!oauthToken || !oauthVerifier) {
    console.log('Missing OAuth parameters, redirecting to dashboard with error')
    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL('/dashboard?error=invalid_oauth_params', baseUrl))
  }
  
  let userId: string | undefined
  
  // Try to get user ID from session first, then token fallback
  if (session?.user?.id) {
    userId = session.user.id
    console.log('Using session for user info')
  } else if (token?.sub) {
    userId = token.sub
    console.log('Using JWT token for user info')
  } else if (userTokenFromUrl) {
    try {
      // Verify the secure token from URL as last resort
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
      const { payload } = await jwtVerify(userTokenFromUrl, secret)
      userId = payload.userId as string
      console.log('Using secure token from URL for user info:', { userId, email: payload.email })
    } catch (error) {
      console.error('Failed to verify secure token:', error)
    }
  }
  
  if (!userId) {
    console.log('ERROR: No user identification found')
    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL('/dashboard?error=session_lost', baseUrl))
  }
  
  console.log('Using userId for Evernote connection:', userId)

  try {
    // Exchange the OAuth verifier for an access token
    console.log('Exchanging OAuth verifier for access token...')
    const { token: accessToken, noteStoreUrl } = await getEvernoteAccessToken(oauthToken, oauthVerifier)
    console.log('Access token received, length:', accessToken?.length)
    console.log('NoteStore URL from access token response:', noteStoreUrl)
    
    // Use noteStoreUrl from access token response if available, otherwise use the one from callback URL
    const finalNoteStoreUrl = noteStoreUrl || edamNoteStoreUrl
    console.log('Final noteStore URL to store:', finalNoteStoreUrl)
    
    // Check if user exists in database
    console.log('Checking if user exists...')
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, image: true }
    })
    
    if (!existingUser) {
      console.log('ERROR: User not found in database - this should not happen as user should be created during sign-in')
      const baseUrl = getBaseUrl()
      return NextResponse.redirect(new URL('/dashboard?error=user_not_found', baseUrl))
    }
    
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

    console.log('Evernote connection successful! Updated user with:', {
      userId: userId,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length,
      noteStoreUrl: finalNoteStoreUrl
    })
    
    const baseUrl = getBaseUrl()
    console.log('Evernote connection completed successfully, redirecting directly to dashboard with bypass')
    
    // Skip success page entirely - redirect directly to dashboard with special bypass flag
    const dashboardUrl = new URL('/dashboard', baseUrl)
    dashboardUrl.searchParams.set('evernote_bypass', 'true')
    dashboardUrl.searchParams.set('success', 'evernote_connected')
    return NextResponse.redirect(dashboardUrl)
  } catch (error) {
    console.error('Error completing Evernote OAuth:', error)
    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL('/dashboard?error=evernote_connection_failed', baseUrl))
  }
}