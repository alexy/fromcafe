// Database-backed storage for OAuth tokens during the flow
// Uses Prisma's VerificationToken table for serverless compatibility

import { prisma } from './prisma'

export const storeTokenSecret = async (token: string, secret: string): Promise<void> => {
  // Use timestamp to make identifier unique and avoid need to delete
  const timestamp = Date.now()
  const uniqueIdentifier = `evernote_oauth:${token}:${timestamp}`
  
  // Store the new token secret with 10 minute expiry
  await prisma.verificationToken.create({
    data: {
      identifier: uniqueIdentifier,
      token: secret,
      expires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    }
  })
  
  console.log('Stored OAuth token secret in database for serverless compatibility')
}

export const getTokenSecret = async (token: string): Promise<string | null> => {
  try {
    const result = await prisma.verificationToken.findFirst({
      where: { 
        identifier: { startsWith: `evernote_oauth:${token}:` },
        expires: { gt: new Date() } // Only get non-expired tokens
      },
      orderBy: { expires: 'desc' } // Get the most recent one
    })
    
    if (!result) {
      console.log('OAuth token secret not found or expired in database')
      return null
    }
    
    console.log('Retrieved OAuth token secret from database')
    return result.token
  } catch (error) {
    console.error('Error retrieving OAuth token secret:', error)
    return null
  }
}

export const removeToken = async (): Promise<void> => {
  // Don't try to delete due to replica identity issues - let expiry handle cleanup
  console.log('OAuth token will expire automatically - skipping manual deletion')
}