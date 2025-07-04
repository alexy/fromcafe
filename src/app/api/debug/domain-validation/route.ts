import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const domain = url.searchParams.get('domain') || 't.photo'

  // Same validation as the add domain endpoint
  const domainRegex = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/
  const regexTest = domainRegex.test(domain)
  const lengthTest = domain.length <= 253
  const doubleDotsTest = !domain.includes('..')
  const startsWithDashTest = !domain.startsWith('-')
  const endsWithDashTest = !domain.endsWith('-')

  const allTests = regexTest && lengthTest && doubleDotsTest && startsWithDashTest && endsWithDashTest

  return NextResponse.json({
    domain,
    tests: {
      regex: regexTest,
      length: lengthTest,
      noDuplicateDots: doubleDotsTest,
      noStartDash: startsWithDashTest,
      noEndDash: endsWithDashTest
    },
    valid: allTests,
    pattern: domainRegex.source
  })
}