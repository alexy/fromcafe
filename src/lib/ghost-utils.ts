/**
 * Normalize post ID from UUID format to Ghost post ID
 * Converts '4beae860-16c9-03d2-08c8-76c1000000000000' to '4beae86016c903d208c876c1'
 */
export function normalizePostId(postId: string): string {
  // If it's already a clean 24-char Ghost ID, return as-is
  if (postId.length === 24 && !postId.includes('-')) {
    return postId
  }
  
  // If it's a UUID format with hyphens, remove them and truncate to 24 chars
  if (postId.includes('-')) {
    return postId.replace(/-/g, '').substring(0, 24)
  }
  
  return postId
}