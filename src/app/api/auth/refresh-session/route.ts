import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    console.log('Session refresh requested - starting fresh session check')
    
    // Force a fresh session check
    const session = await getServerSession(authOptions)
    
    console.log('Fresh session check completed:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      sessionData: session ? 'present' : 'null'
    })
    
    if (session?.user?.id) {
      console.log('Valid session found - preparing response')
      
      // Session is valid, force browser to refresh its session cache
      const response = NextResponse.json({ 
        success: true, 
        sessionValid: true,
        userId: session.user.id 
      })
      
      // Force session cookie refresh by updating its value
      const cookieStore = await cookies()
      const sessionCookie = cookieStore.get('next-auth.session-token') || cookieStore.get('__Secure-next-auth.session-token')
      
      console.log('Session cookie check:', {
        foundStandardCookie: !!cookieStore.get('next-auth.session-token'),
        foundSecureCookie: !!cookieStore.get('__Secure-next-auth.session-token'),
        cookieName: sessionCookie?.name,
        cookieExists: !!sessionCookie
      })
      
      if (sessionCookie) {
        console.log('Refreshing session cookie:', sessionCookie.name)
        response.cookies.set(sessionCookie.name, sessionCookie.value, {
          httpOnly: true,
          secure: process.env.VERCEL ? true : false,
          sameSite: process.env.VERCEL ? 'none' : 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60 // 30 days
        })
      } else {
        console.log('No session cookie found to refresh')
      }
      
      console.log('Session refresh endpoint returning success')
      return response
    } else {
      console.log('No valid session found during refresh - user not authenticated')
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