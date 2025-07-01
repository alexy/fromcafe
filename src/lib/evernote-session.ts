// Temporary storage for OAuth tokens during the flow
// In production, this should use Redis or another persistent store

interface TokenData {
  secret: string
  timestamp: number
}

const tokenStore = new Map<string, TokenData>()

// Clean up old tokens (older than 10 minutes)
const cleanupOldTokens = () => {
  const now = Date.now()
  const tenMinutes = 10 * 60 * 1000
  
  for (const [token, data] of tokenStore.entries()) {
    if (now - data.timestamp > tenMinutes) {
      tokenStore.delete(token)
    }
  }
}

export const storeTokenSecret = (token: string, secret: string): void => {
  cleanupOldTokens()
  tokenStore.set(token, {
    secret,
    timestamp: Date.now()
  })
}

export const getTokenSecret = (token: string): string | null => {
  cleanupOldTokens()
  const data = tokenStore.get(token)
  return data ? data.secret : null
}

export const removeToken = (token: string): void => {
  tokenStore.delete(token)
}