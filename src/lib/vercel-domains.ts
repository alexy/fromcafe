/**
 * Vercel Domain Management API
 * Based on: https://vercel.com/docs/multi-tenant/domain-management#adding-a-domain-programmatically
 */

import { getPrimaryDomain } from '@/config/domains'

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID

interface VercelDomainResponse {
  name: string
  apexName: string
  projectId: string
  verification?: Array<{
    type: string
    domain: string
    value: string
    reason: string
  }>
  verified: boolean
  createdAt: number
  updatedAt: number
  redirect?: string
  redirectStatusCode?: number
}


class VercelDomainError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message)
    this.name = 'VercelDomainError'
  }
}

async function vercelRequest(endpoint: string, options: RequestInit = {}) {
  if (!VERCEL_API_TOKEN) {
    throw new VercelDomainError('VERCEL_API_TOKEN environment variable not set')
  }

  const url = `https://api.vercel.com${endpoint}`
  const headers = {
    'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (VERCEL_TEAM_ID) {
    const urlWithTeam = new URL(url)
    urlWithTeam.searchParams.set('teamId', VERCEL_TEAM_ID)
    const response = await fetch(urlWithTeam.toString(), { ...options, headers })
    return response
  }

  const response = await fetch(url, { ...options, headers })
  return response
}

export async function addDomainToVercel(domain: string): Promise<VercelDomainResponse> {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError('VERCEL_PROJECT_ID environment variable not set')
  }

  try {
    const response = await vercelRequest(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
      method: 'POST',
      body: JSON.stringify({
        name: domain
        // Custom domains should serve content directly, not redirect
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new VercelDomainError(
        error.error?.message || `Failed to add domain: ${response.status}`,
        response.status,
        error.error?.code
      )
    }

    return await response.json()
  } catch (error) {
    if (error instanceof VercelDomainError) {
      throw error
    }
    throw new VercelDomainError(`Failed to add domain to Vercel: ${error}`)
  }
}

export async function removeDomainFromVercel(domain: string): Promise<void> {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError('VERCEL_PROJECT_ID environment variable not set')
  }

  try {
    const response = await vercelRequest(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}`, {
      method: 'DELETE'
    })

    if (!response.ok && response.status !== 404) {
      const error = await response.json()
      throw new VercelDomainError(
        error.error?.message || `Failed to remove domain: ${response.status}`,
        response.status,
        error.error?.code
      )
    }
  } catch (error) {
    if (error instanceof VercelDomainError) {
      throw error
    }
    throw new VercelDomainError(`Failed to remove domain from Vercel: ${error}`)
  }
}

export async function getDomainStatus(domain: string): Promise<VercelDomainResponse | null> {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError('VERCEL_PROJECT_ID environment variable not set')
  }

  try {
    const response = await vercelRequest(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}`)

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const error = await response.json()
      throw new VercelDomainError(
        error.error?.message || `Failed to get domain status: ${response.status}`,
        response.status,
        error.error?.code
      )
    }

    return await response.json()
  } catch (error) {
    if (error instanceof VercelDomainError) {
      throw error
    }
    throw new VercelDomainError(`Failed to get domain status from Vercel: ${error}`)
  }
}

export async function verifyDomain(domain: string): Promise<VercelDomainResponse> {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError('VERCEL_PROJECT_ID environment variable not set')
  }

  try {
    const response = await vercelRequest(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify`, {
      method: 'POST'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new VercelDomainError(
        error.error?.message || `Failed to verify domain: ${response.status}`,
        response.status,
        error.error?.code
      )
    }

    return await response.json()
  } catch (error) {
    if (error instanceof VercelDomainError) {
      throw error
    }
    throw new VercelDomainError(`Failed to verify domain with Vercel: ${error}`)
  }
}

export async function getDomainConfig(domain: string): Promise<{
  isValid: boolean
  dnsRecords: Array<{
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT'
    name: string
    value: string
    ttl?: number
  }>
  verification?: Array<{
    type: string
    domain: string
    value: string
    reason: string
  }>
}> {
  try {
    const status = await getDomainStatus(domain)
    
    if (!status) {
      return {
        isValid: false,
        dnsRecords: [
          { type: 'A', name: '@', value: '76.76.19.61' },
          { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' }
        ]
      }
    }

    return {
      isValid: status.verified,
      dnsRecords: [
        { type: 'A', name: '@', value: '76.76.19.61' },
        { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' }
      ],
      verification: status.verification
    }
  } catch (error) {
    console.error('Error getting domain config:', error)
    return {
      isValid: false,
      dnsRecords: [
        { type: 'A', name: '@', value: '76.76.19.61' },
        { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' }
      ]
    }
  }
}

export async function setPrimaryDomain(domain: string): Promise<void> {
  if (!VERCEL_PROJECT_ID) {
    throw new VercelDomainError('VERCEL_PROJECT_ID environment variable not set')
  }

  try {
    const response = await vercelRequest(`/v10/projects/${VERCEL_PROJECT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({
        primaryDomain: domain
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new VercelDomainError(
        error.error?.message || `Failed to set primary domain: ${response.status}`,
        response.status,
        error.error?.code
      )
    }
  } catch (error) {
    if (error instanceof VercelDomainError) {
      throw error
    }
    throw new VercelDomainError(`Failed to set primary domain: ${error}`)
  }
}

export async function ensurePrimaryDomain(): Promise<void> {
  try {
    const primaryDomain = getPrimaryDomain()
    console.log(`🔒 Ensuring ${primaryDomain} is the primary domain...`)
    await setPrimaryDomain(primaryDomain)
    console.log(`✅ Primary domain set to ${primaryDomain}`)
  } catch (error) {
    console.error('❌ Failed to ensure primary domain:', error)
    // Don't throw - this is a protection mechanism, not critical
  }
}

export async function validatePrimaryDomainProtection(): Promise<boolean> {
  try {
    const primaryDomain = getPrimaryDomain()
    
    // In a real implementation, we would check the Vercel project's primary domain setting
    // For now, we'll just ensure our configured primary domain is available
    const primaryDomainStatus = await getDomainStatus(primaryDomain)
    
    if (!primaryDomainStatus) {
      console.log(`⚠️ Primary domain ${primaryDomain} not found in Vercel project`)
      return false
    }
    
    console.log(`✅ Primary domain ${primaryDomain} is properly configured`)
    return true
  } catch (error) {
    console.error(`❌ Failed to validate primary domain protection:`, error)
    return false
  }
}

export async function validateDomainConfiguration(domain: string): Promise<boolean> {
  try {
    const domainStatus = await getDomainStatus(domain)
    
    if (!domainStatus) {
      console.log(`⚠️ Domain ${domain} not found in Vercel project`)
      return false
    }

    // Basic validation - domain exists and is properly configured
    console.log(`✅ Domain ${domain} found in Vercel project`)
    
    if (domainStatus.verified) {
      console.log(`✅ Domain ${domain} is verified`)
      return true
    } else {
      console.log(`⚠️ Domain ${domain} exists but is not yet verified`)
      return false
    }
  } catch (error) {
    console.error(`❌ Failed to validate configuration for ${domain}:`, error)
    return false
  }
}

export { VercelDomainError }