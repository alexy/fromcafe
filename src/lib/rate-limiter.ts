// Simple rate limiter to prevent too many API calls
class RateLimiter {
  private lastRequests = new Map<string, number>()
  
  canMakeRequest(key: string, minIntervalMs: number = 5000): boolean {
    const now = Date.now()
    const lastRequest = this.lastRequests.get(key) || 0
    
    if (now - lastRequest < minIntervalMs) {
      return false
    }
    
    this.lastRequests.set(key, now)
    return true
  }
  
  getTimeUntilNextRequest(key: string, minIntervalMs: number = 5000): number {
    const now = Date.now()
    const lastRequest = this.lastRequests.get(key) || 0
    const timeLeft = minIntervalMs - (now - lastRequest)
    
    return Math.max(0, timeLeft)
  }
}

export const rateLimiter = new RateLimiter()