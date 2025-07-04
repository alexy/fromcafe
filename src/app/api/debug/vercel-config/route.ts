import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if environment variables are set
  const config = {
    hasApiToken: !!process.env.VERCEL_API_TOKEN,
    hasProjectId: !!process.env.VERCEL_PROJECT_ID,
    hasTeamId: !!process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID ? 
      process.env.VERCEL_PROJECT_ID.substring(0, 8) + '...' : 
      'Not set',
    teamId: process.env.VERCEL_TEAM_ID ? 
      process.env.VERCEL_TEAM_ID.substring(0, 8) + '...' : 
      'Not set (optional)',
    tokenLength: process.env.VERCEL_API_TOKEN ? 
      process.env.VERCEL_API_TOKEN.length : 
      0
  }

  return NextResponse.json({
    success: true,
    config,
    ready: config.hasApiToken && config.hasProjectId
  })
}