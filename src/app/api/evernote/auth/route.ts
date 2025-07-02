import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvernoteAuthUrl } from '@/lib/evernote'
import { SignJWT } from 'jose'

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Create a secure token with user info that will survive the OAuth flow
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const token = await new SignJWT({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret)

    const authUrl = await getEvernoteAuthUrl(token) // Pass token instead of userId
    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Error getting Evernote auth URL:', error)
    return NextResponse.json({ error: 'Failed to get auth URL' }, { status: 500 })
  }
}