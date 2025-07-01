import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Remove Evernote credentials from the user's account
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        evernoteToken: null,
        evernoteUserId: null,
        evernoteNoteStoreUrl: null
      },
    })

    console.log('Successfully disconnected Evernote for user:', session.user.id)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Successfully disconnected from Evernote' 
    })
  } catch (error) {
    console.error('Error disconnecting from Evernote:', error)
    return NextResponse.json({ 
      error: 'Failed to disconnect from Evernote' 
    }, { status: 500 })
  }
}