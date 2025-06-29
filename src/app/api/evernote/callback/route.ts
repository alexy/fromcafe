import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.redirect('/auth/signin')
  }

  const { searchParams } = new URL(request.url)
  const oauthToken = searchParams.get('oauth_token')
  const oauthVerifier = searchParams.get('oauth_verifier')

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.redirect('/dashboard?error=invalid_oauth')
  }

  try {
    // In a real implementation, you would exchange the OAuth verifier for an access token
    // For now, we'll store the token (this is simplified)
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        evernoteToken: oauthToken, // In reality, this would be the access token
        evernoteUserId: 'temp_user_id', // Would be returned from Evernote
      },
    })

    return NextResponse.redirect('/dashboard?success=evernote_connected')
  } catch (error) {
    console.error('Error saving Evernote token:', error)
    return NextResponse.redirect('/dashboard?error=connection_failed')
  }
}