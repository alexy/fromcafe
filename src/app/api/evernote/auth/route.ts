import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvernoteAuthUrl } from '@/lib/evernote'

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const authUrl = getEvernoteAuthUrl()
    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Error getting Evernote auth URL:', error)
    return NextResponse.json({ error: 'Failed to get auth URL' }, { status: 500 })
  }
}