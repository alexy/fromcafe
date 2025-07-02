import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    console.log('Session refresh requested')
    
    // Force a fresh session check
    const session = await getServerSession(authOptions)
    
    console.log('Refresh session result:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    })
    
    if (session?.user?.id) {
      // Session is valid, force browser to refresh its session cache
      const response = NextResponse.json({ 
        success: true, 
        sessionValid: true,
        userId: session.user.id 
      })
      
      // Force session cookie refresh by updating its value
      const cookieStore = cookies()
      const sessionCookie = cookieStore.get('next-auth.session-token') || cookieStore.get('__Secure-next-auth.session-token')
      
      if (sessionCookie) {
        console.log('Refreshing session cookie')
        response.cookies.set(sessionCookie.name, sessionCookie.value, {
          httpOnly: true,
          secure: process.env.VERCEL ? true : false,
          sameSite: process.env.VERCEL ? 'none' : 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60 // 30 days
        })
      }
      
      return response
    } else {
      console.log('No valid session found during refresh')
      return NextResponse.json({ 
        success: false, 
        sessionValid: false,
        error: 'No valid session' 
      })
    }
  } catch (error) {
    console.error('Session refresh error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Session refresh failed' 
    }, { status: 500 })
  }
}