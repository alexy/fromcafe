import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  
  console.log('Evernote status check for user:', session?.user?.id)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        evernoteToken: true,
        evernoteUserId: true,
        evernoteNoteStoreUrl: true
      },
    })

    console.log('User Evernote status:', {
      userId: session.user.id,
      userExists: !!user,
      hasEvernoteToken: !!user?.evernoteToken,
      evernoteUserId: user?.evernoteUserId,
      hasNoteStoreUrl: !!user?.evernoteNoteStoreUrl
    })

    return NextResponse.json({ 
      connected: !!user?.evernoteToken 
    })
  } catch (error) {
    console.error('Error checking Evernote status:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}