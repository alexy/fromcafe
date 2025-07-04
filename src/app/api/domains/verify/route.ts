import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDomainStatus, verifyDomain } from '@/lib/vercel-domains'
import { promises as dns } from 'dns'

interface VerificationReport {
  success: boolean
  verified: boolean
  domain: string
  timestamp: string
  checks: {
    domainExists: { status: 'pass' | 'fail' | 'warn', message: string }
    dnsRecords: { status: 'pass' | 'fail' | 'warn', message: string, records?: string[] }
    vercelConfig: { status: 'pass' | 'fail' | 'warn', message: string }
    sslCertificate: { status: 'pass' | 'fail' | 'warn', message: string }
    domainRouting: { status: 'pass' | 'fail' | 'warn', message: string }
  }
  recommendations: string[]
  vercelStatus?: unknown
}

async function performDomainVerification(domain: string): Promise<VerificationReport> {
  const report: VerificationReport = {
    success: false,
    verified: false,
    domain,
    timestamp: new Date().toISOString(),
    checks: {
      domainExists: { status: 'fail', message: 'Not checked' },
      dnsRecords: { status: 'fail', message: 'Not checked' },
      vercelConfig: { status: 'fail', message: 'Not checked' },
      sslCertificate: { status: 'fail', message: 'Not checked' },
      domainRouting: { status: 'fail', message: 'Not checked' }
    },
    recommendations: []
  }

  try {
    // 1. Check if domain exists in DNS
    console.log(`🔍 Checking if domain ${domain} exists...`)
    try {
      const aRecords = await dns.resolve4(domain)
      if (aRecords && aRecords.length > 0) {
        report.checks.domainExists = {
          status: 'pass',
          message: `Domain resolves to ${aRecords.length} A record(s): ${aRecords.join(', ')}`
        }
      } else {
        report.checks.domainExists = {
          status: 'fail',
          message: 'Domain does not resolve to any A records'
        }
        report.recommendations.push('Add an A record pointing to 216.198.79.1')
      }
    } catch (dnsError) {
      report.checks.domainExists = {
        status: 'fail',
        message: `DNS lookup failed: ${dnsError instanceof Error ? dnsError.message : 'Unknown error'}`
      }
      report.recommendations.push('Check if domain is correctly configured in your DNS provider')
    }

    // 2. Check DNS records configuration
    console.log(`🔍 Checking DNS records for ${domain}...`)
    try {
      const [aRecords, cnameRecords] = await Promise.allSettled([
        dns.resolve4(domain),
        dns.resolveCname(`www.${domain}`)
      ])

      let dnsMessage = ''
      let dnsStatus: 'pass' | 'fail' | 'warn' = 'pass'

      if (aRecords.status === 'fulfilled') {
        const vercelIPs = ['216.198.79.1', '76.76.19.61']
        const hasCorrectIP = aRecords.value.some(ip => vercelIPs.includes(ip))
        
        if (hasCorrectIP) {
          dnsMessage += `✅ A record correctly points to Vercel (${aRecords.value.join(', ')}). `
        } else {
          dnsMessage += `⚠️ A record exists but may not point to Vercel (${aRecords.value.join(', ')}). `
          dnsStatus = 'warn'
          report.recommendations.push('Ensure A record points to 216.198.79.1')
        }
      } else {
        dnsMessage += '❌ No A record found. '
        dnsStatus = 'fail'
        report.recommendations.push('Add an A record pointing to 216.198.79.1')
      }

      if (cnameRecords.status === 'fulfilled') {
        const hasVercelCname = cnameRecords.value.some(cname => cname.includes('vercel'))
        if (hasVercelCname) {
          dnsMessage += `✅ CNAME record correctly configured (${cnameRecords.value.join(', ')}). `
        } else {
          dnsMessage += `⚠️ CNAME record exists but may not point to Vercel (${cnameRecords.value.join(', ')}). `
          dnsStatus = 'warn'
          report.recommendations.push('Ensure www CNAME record points to cname.vercel-dns.com')
        }
      } else {
        dnsMessage += '⚠️ No CNAME record found for www subdomain. '
        if (dnsStatus === 'pass') dnsStatus = 'warn'
        report.recommendations.push('Add a CNAME record for www pointing to cname.vercel-dns.com')
      }

      report.checks.dnsRecords = { status: dnsStatus, message: dnsMessage.trim() }
    } catch (dnsError) {
      report.checks.dnsRecords = {
        status: 'fail',
        message: `DNS record check failed: ${dnsError instanceof Error ? dnsError.message : 'Unknown error'}`
      }
    }

    // 3. Check Vercel configuration
    console.log(`🔍 Checking Vercel configuration for ${domain}...`)
    try {
      const vercelStatus = await getDomainStatus(domain)
      
      if (!vercelStatus) {
        report.checks.vercelConfig = {
          status: 'fail',
          message: 'Domain not found in Vercel project'
        }
        report.recommendations.push('Add the domain to your Vercel project')
      } else {
        report.vercelStatus = vercelStatus
        
        if (vercelStatus.verified) {
          report.checks.vercelConfig = {
            status: 'pass',
            message: 'Domain is verified in Vercel'
          }
          report.verified = true
        } else {
          report.checks.vercelConfig = {
            status: 'warn',
            message: 'Domain exists in Vercel but not yet verified'
          }
          
          if (vercelStatus.verification) {
            const verificationReasons = vercelStatus.verification.map(v => v.reason).join(', ')
            report.checks.vercelConfig.message += `. Verification issues: ${verificationReasons}`
          }
        }
      }
    } catch (vercelError) {
      report.checks.vercelConfig = {
        status: 'fail',
        message: `Vercel configuration check failed: ${vercelError instanceof Error ? vercelError.message : 'Unknown error'}`
      }
    }

    // 4. Check SSL certificate
    console.log(`🔍 Checking SSL certificate for ${domain}...`)
    try {
      const response = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      })
      
      if (response.ok) {
        report.checks.sslCertificate = {
          status: 'pass',
          message: 'SSL certificate is valid and working'
        }
      } else {
        report.checks.sslCertificate = {
          status: 'warn',
          message: `HTTPS connection returned status ${response.status}`
        }
      }
    } catch (sslError) {
      report.checks.sslCertificate = {
        status: 'fail',
        message: `SSL certificate check failed: ${sslError instanceof Error ? sslError.message : 'Unknown error'}`
      }
      report.recommendations.push('Wait for SSL certificate to be issued (can take 5-15 minutes)')
    }

    // 5. Check domain routing and redirect configuration
    console.log(`🔍 Checking domain routing and redirects for ${domain}...`)
    try {
      const response = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
        redirect: 'manual'
      })
      
      if (response.status >= 200 && response.status < 300) {
        report.checks.domainRouting = {
          status: 'pass',
          message: 'Domain serves content directly and is working correctly'
        }
      } else if (response.status === 307 || response.status === 308) {
        // Custom domains should not redirect - they should serve content
        const location = response.headers.get('location')
        report.checks.domainRouting = {
          status: 'warn',
          message: `Domain redirects (${response.status} → ${location || 'unknown'}). Custom domains should serve content directly.`
        }
        report.recommendations.push('Remove redirect configuration to allow domain to serve content directly')
      } else if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        report.checks.domainRouting = {
          status: 'warn',
          message: `Domain redirects with status ${response.status} to ${location || 'unknown location'}`
        }
      } else {
        report.checks.domainRouting = {
          status: 'fail',
          message: `Domain routing failed with status ${response.status}`
        }
      }
    } catch (routingError) {
      report.checks.domainRouting = {
        status: 'fail',
        message: `Domain routing check failed: ${routingError instanceof Error ? routingError.message : 'Unknown error'}`
      }
    }

    // Determine overall success
    const allChecks = Object.values(report.checks)
    const hasFailures = allChecks.some(check => check.status === 'fail')
    
    if (!hasFailures && report.verified) {
      report.success = true
    } else if (!hasFailures) {
      report.success = true
      report.recommendations.push('Domain configuration looks good, but verification is still pending')
    }

    return report

  } catch (error) {
    console.error('Error in domain verification:', error)
    report.checks.domainExists.message = `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    return report
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { blogId } = body

    if (!blogId) {
      return NextResponse.json({ error: 'BlogId is required' }, { status: 400 })
    }

    // Check if user owns the blog
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        userId: session.user.id
      }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found or unauthorized' }, { status: 404 })
    }

    if (!blog.customDomain) {
      return NextResponse.json({ error: 'Blog does not have a custom domain' }, { status: 400 })
    }

    const domain = blog.customDomain

    console.log(`🔍 Starting comprehensive domain verification for ${domain}...`)

    // Perform comprehensive verification
    const report = await performDomainVerification(domain)

    // If domain is not verified in Vercel, attempt verification
    if (!report.verified && report.vercelStatus) {
      try {
        console.log(`🔍 Attempting Vercel domain verification for ${domain}...`)
        const verificationResult = await verifyDomain(domain)
        
        // Update report with verification attempt
        if (verificationResult.verified) {
          report.verified = true
          report.success = true
          report.checks.vercelConfig = {
            status: 'pass',
            message: 'Domain successfully verified in Vercel'
          }
        } else {
          report.checks.vercelConfig = {
            status: 'warn',
            message: 'Verification attempted but domain is still not verified. This may take a few minutes.'
          }
        }
        
        report.vercelStatus = verificationResult
      } catch (vercelError) {
        console.error('Vercel verification failed:', vercelError)
        report.checks.vercelConfig = {
          status: 'fail',
          message: `Vercel verification failed: ${vercelError instanceof Error ? vercelError.message : 'Unknown error'}`
        }
      }
    }

    console.log(`✅ Domain verification complete for ${domain}. Success: ${report.success}`)

    return NextResponse.json(report)

  } catch (error) {
    console.error('Error in domain verification API:', error)
    return NextResponse.json({ 
      error: 'Failed to verify custom domain',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}