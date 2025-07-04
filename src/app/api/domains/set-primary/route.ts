import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setPrimaryDomain } from '@/lib/vercel-domains'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { domain } = await request.json()
    
    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/
    if (!domainRegex.test(domain) || domain.length > 253 || domain.includes('..')) {
      return NextResponse.json({ 
        error: 'Invalid domain format. Please enter a valid domain like example.com'
      }, { status: 400 })
    }

    await setPrimaryDomain(domain)

    return NextResponse.json({ 
      success: true,
      message: `Primary domain set to ${domain}`
    })
  } catch (error: unknown) {
    console.error('Error setting primary domain:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to set primary domain'
    }, { status: 500 })
  }
}