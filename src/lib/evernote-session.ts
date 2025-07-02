// Database-backed storage for OAuth tokens during the flow
// Uses Prisma's VerificationToken table for serverless compatibility

import { prisma } from './prisma'

export const storeTokenSecret = async (token: string, secret: string): Promise<void> => {
  // Clean up any existing token with same identifier
  await prisma.verificationToken.deleteMany({
    where: { identifier: `evernote_oauth:${token}` }
  })
  
  // Store the new token secret with 10 minute expiry
  await prisma.verificationToken.create({
    data: {
      identifier: `evernote_oauth:${token}`,
      token: secret,
      expires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    }
  })
  
  console.log('Stored OAuth token secret in database for serverless compatibility')
}

export const getTokenSecret = async (token: string): Promise<string | null> => {
  try {
    const result = await prisma.verificationToken.findFirst({
      where: { identifier: `evernote_oauth:${token}` }
    })
    
    if (!result) {
      console.log('OAuth token secret not found in database')
      return null
    }
    
    // Check if expired
    if (result.expires < new Date()) {
      console.log('OAuth token secret expired, removing from database')
      await prisma.verificationToken.deleteMany({
        where: { identifier: `evernote_oauth:${token}` }
      })
      return null
    }
    
    console.log('Retrieved OAuth token secret from database')
    return result.token
  } catch (error) {
    console.error('Error retrieving OAuth token secret:', error)
    return null
  }
}

export const removeToken = async (token: string): Promise<void> => {
  await prisma.verificationToken.deleteMany({
    where: { identifier: `evernote_oauth:${token}` }
  })
  console.log('Removed OAuth token secret from database')
}