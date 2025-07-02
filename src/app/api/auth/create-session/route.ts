import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EncryptJWT } from 'jose'

export async function POST() {
  try {
    console.log('Creating manual NextAuth session after Evernote OAuth')
    
    // Get the user who just completed Evernote OAuth
    // We'll identify them by looking for recently updated Evernote tokens
    const recentUser = await prisma.user.findFirst({
      where: {
        evernoteToken: { not: null },
        // Look for users updated in the last 5 minutes
        updatedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000)
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })
    
    if (!recentUser) {
      console.log('No recent Evernote user found for session creation')
      return NextResponse.json({ 
        success: false, 
        error: 'No recent user found' 
      })
    }
    
    console.log('Found recent Evernote user for session:', {
      userId: recentUser.id,
      email: recentUser.email,
      name: recentUser.name
    })
    
    // Create a NextAuth-compatible JWE session token (encrypted)
    // Use NextAuth's key derivation process (HKDF with SHA-256)
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    
    // Derive key using HKDF-SHA256 (same as NextAuth)
    const baseKey = await crypto.subtle.importKey(
      'raw',
      secret,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    )
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(),
        info: new TextEncoder().encode('NextAuth.js Generated Encryption Key')
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
    
    const sessionToken = await new EncryptJWT({
      sub: recentUser.id,
      email: recentUser.email,
      name: recentUser.name,
      picture: recentUser.image,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days (matches NextAuth config)
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .encrypt(key)
    
    // Set the session cookie manually
    const isSecure = !!process.env.VERCEL
    const cookieName = isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
    
    const response = NextResponse.json({ 
      success: true,
      userId: recentUser.id,
      sessionCreated: true
    })
    
    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days (matches NextAuth config)
    })
    
    console.log('Manual session created successfully for user:', recentUser.id)
    return response
    
  } catch (error) {
    console.error('Error creating manual session:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create session' 
    }, { status: 500 })
  }
}