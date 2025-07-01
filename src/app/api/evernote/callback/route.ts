import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEvernoteAccessToken } from '@/lib/evernote'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  console.log('OAuth callback session:', {
    hasSession: !!session,
    userId: session?.user?.id,
    userEmail: session?.user?.email
  })
  
  if (!session?.user?.id) {
    console.log('No session or user ID, redirecting to signin')
    return NextResponse.redirect(new URL('/auth/signin', request.url))
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
    return NextResponse.redirect(new URL('/dashboard?error=invalid_oauth', request.url))
  }

  try {
    // Exchange the OAuth verifier for an access token
    console.log('Exchanging OAuth verifier for access token...')
    const { token: accessToken, secret: _accessTokenSecret, noteStoreUrl } = await getEvernoteAccessToken(oauthToken, oauthVerifier)
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

    return NextResponse.redirect(new URL('/dashboard?success=evernote_connected', request.url))
  } catch (error) {
    console.error('Error completing Evernote OAuth:', error)
    return NextResponse.redirect(new URL('/dashboard?error=connection_failed', request.url))
  }
}