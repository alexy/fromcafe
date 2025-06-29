import { NextRequest, NextResponse } from 'next/server'
import { SyncService } from '@/lib/sync'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  // Verify the request is from a cron job or authorized source
  const authHeader = request.headers.get('authorization')
  
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Starting scheduled sync...')
    
    const users = await prisma.user.findMany({
      where: {
        evernoteToken: { not: null },
      },
      select: { id: true },
    })

    let syncedCount = 0
    let errorCount = 0

    for (const user of users) {
      try {
        await SyncService.syncUserBlogs(user.id)
        syncedCount++
      } catch (error) {
        console.error(`Failed to sync user ${user.id}:`, error)
        errorCount++
      }
    }
    
    console.log(`Scheduled sync completed: ${syncedCount} users synced, ${errorCount} errors`)
    
    return NextResponse.json({ 
      success: true,
      syncedUsers: syncedCount,
      errors: errorCount,
      message: 'Sync completed successfully'
    })
  } catch (error) {
    console.error('Cron sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}