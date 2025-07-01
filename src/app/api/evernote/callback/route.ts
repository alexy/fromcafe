import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
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
  const session = await getServerSession(authOptions)
  
  console.log('OAuth callback session:', {
    hasSession: !!session,
    userId: session?.user?.id,
    userEmail: session?.user?.email
  })
  
  if (!session?.user?.id) {
    console.log('No session or user ID, redirecting to signin')
    const baseUrl = getBaseUrl()
    console.log('Using base URL for redirect:', baseUrl)
    return NextResponse.redirect(new URL('/auth/signin', baseUrl))
  }

  const { searchParams } = new URL(request.url)
  const oauthToken = searchParams.get('oauth_token')
  const oauthVerifier = searchParams.get('oauth_verifier')
  const edamNoteStoreUrl = searchParams.get('edam_noteStoreUrl')

  console.log('OAuth callback parameters:', {
    oauthToken: oauthToken ? 'present' : 'missing',
    oauthVerifier: oauthVerifier ? 'present' : 'missing',
    edamNoteStoreUrl: edamNoteStoreUrl || 'not provided'
  })

  if (!oauthToken || !oauthVerifier) {
    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL('/dashboard?error=invalid_oauth', baseUrl))
  }

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
      where: { id: session.user.id },
      select: { id: true, email: true }
    })
    
    if (!existingUser) {
      console.log('User not found in database, creating user...')
      // Create the user if they don't exist
      await prisma.user.create({
        data: {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.name,
          image: session.user.image,
          evernoteToken: accessToken,
          evernoteUserId: session.user.id,
          evernoteNoteStoreUrl: finalNoteStoreUrl,
        }
      })
    } else {
      console.log('User exists, updating with Evernote credentials...')
      // Store the access token and noteStore URL in the database
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          evernoteToken: accessToken,
          evernoteUserId: session.user.id, // Use the user's ID for now
          evernoteNoteStoreUrl: finalNoteStoreUrl, // Store the noteStore URL from OAuth
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