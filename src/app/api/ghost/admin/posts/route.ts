import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/ghost/admin/posts - Create posts (Ghost Admin API compatible)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  console.log('👻 POST /api/ghost/admin/posts handler called!')
  
  // TEMPORARY: Simple test response to check if Ulysses receives anything
  console.log('👻 Returning test response')
  return NextResponse.json({
    posts: [{
      id: "test123456789012345678901234",
      uuid: "test1234-5678-9012-3456-789012345678",
      title: "Test Post",
      slug: "test-post", 
      html: "<p>Test content</p>",
      status: "published"
    }]
  }, { status: 201 })
}

/**
 * GET /api/ghost/admin/posts - List posts (Ghost Admin API compatible)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  console.log('👻 GET /api/ghost/admin/posts handler called!')
  
  return NextResponse.json({
    posts: [],
    meta: {
      pagination: {
        page: 1,
        limit: 15,
        pages: 1,
        total: 0,
        next: null,
        prev: null
      }
    }
  })
}