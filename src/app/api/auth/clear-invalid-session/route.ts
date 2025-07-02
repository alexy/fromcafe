import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST() {
  try {
    // Try to get the session
    const session = await getServerSession(authOptions)
    
    if (session) {
      return NextResponse.json({ 
        success: true, 
        hasValidSession: true,
        message: 'Session is valid' 
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      hasValidSession: false,
      message: 'No session found' 
    })
    
  } catch (error) {
    // If there's a JWT decryption error, clear the session cookies
    console.log('JWT error detected, clearing invalid session cookies:', error)
    
    const response = NextResponse.json({ 
      success: true, 
      hasValidSession: false,
      clearedInvalidCookies: true,
      message: 'Cleared invalid session cookies' 
    })
    
    // Clear both secure and non-secure variants of NextAuth cookies
    const cookieOptions = {
      httpOnly: true,
      secure: !!process.env.VERCEL,
      sameSite: process.env.VERCEL ? 'none' as const : 'lax' as const,
      path: '/',
      maxAge: 0 // Expire immediately
    }
    
    // Clear the main session token
    response.cookies.set('next-auth.session-token', '', cookieOptions)
    if (process.env.VERCEL) {
      response.cookies.set('__Secure-next-auth.session-token', '', cookieOptions)
    }
    
    // Clear callback URL cookie if it exists
    response.cookies.set('next-auth.callback-url', '', { ...cookieOptions, httpOnly: false })
    if (process.env.VERCEL) {
      response.cookies.set('__Secure-next-auth.callback-url', '', { ...cookieOptions, httpOnly: false })  
    }
    
    // Clear CSRF token cookie if it exists
    response.cookies.set('next-auth.csrf-token', '', { ...cookieOptions, httpOnly: false })
    if (process.env.VERCEL) {
      response.cookies.set('__Secure-next-auth.csrf-token', '', { ...cookieOptions, httpOnly: false })
    }
    
    return response
  }
}