import { SyncService } from './sync'

let isInitialized = false

export function initializeServer() {
  if (isInitialized) {
    return
  }
  
  console.log('Initializing server...')
  
  // Start the automatic sync scheduler
  SyncService.startSyncScheduler()
  console.log('Automatic sync scheduler started (every 15 minutes)')
  
  isInitialized = true
}