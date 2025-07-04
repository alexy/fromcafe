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
      0,
    projectIdFull: process.env.VERCEL_PROJECT_ID || 'Not set',
    tokenPrefix: process.env.VERCEL_API_TOKEN ? 
      process.env.VERCEL_API_TOKEN.substring(0, 12) + '...' : 
      'Not set'
  }

  // Test Vercel API connectivity
  let apiTest = null
  if (config.hasApiToken && config.hasProjectId) {
    try {
      const headers = {
        'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json'
      }

      const testUrl = process.env.VERCEL_TEAM_ID ? 
        `https://api.vercel.com/v10/projects/${process.env.VERCEL_PROJECT_ID}?teamId=${process.env.VERCEL_TEAM_ID}` :
        `https://api.vercel.com/v10/projects/${process.env.VERCEL_PROJECT_ID}`

      const testResponse = await fetch(testUrl, { headers })
      
      apiTest = {
        url: testUrl,
        status: testResponse.status,
        ok: testResponse.ok,
        statusText: testResponse.statusText
      }

      if (!testResponse.ok) {
        const errorData = await testResponse.json().catch(() => ({ error: 'Failed to parse error response' }))
        apiTest.error = errorData
      }
    } catch (error) {
      apiTest = {
        error: 'API test failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  return NextResponse.json({
    success: true,
    config,
    apiTest,
    ready: config.hasApiToken && config.hasProjectId
  })
}