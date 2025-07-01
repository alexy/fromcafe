import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EvernoteService } from '@/lib/evernote'

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        evernoteToken: true,
        evernoteNoteStoreUrl: true 
      },
    })

    if (!user?.evernoteToken) {
      return NextResponse.json({ error: 'Evernote not connected' }, { status: 400 })
    }

    const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl)
    const notebooks = await evernoteService.getNotebooks()

    return NextResponse.json({ notebooks })
  } catch (error) {
    console.error('Error fetching Evernote notebooks:', error)
    
    // If it's a rate limit error, return more specific message
    if (error instanceof Error && error.message.includes('rate limit exceeded')) {
      return NextResponse.json({ 
        error: error.message,
        isRateLimit: true 
      }, { status: 429 })
    }
    
    return NextResponse.json({ error: 'Failed to fetch notebooks' }, { status: 500 })
  }
}