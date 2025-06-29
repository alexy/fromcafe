import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SyncService } from '@/lib/sync'

export async function POST() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await SyncService.syncUserBlogs(session.user.id)
    return NextResponse.json({ success: true, message: 'Sync completed successfully' })
  } catch (error) {
    console.error('Manual sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}