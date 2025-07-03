# Sync State Reset Guide

## Problem Solved

The sync system was incorrectly skipping syncs by comparing against failed sync attempts instead of successful ones. This has been fixed with better sync state tracking and reset functionality.

## Reset Options

### 1. Web Interface (Recommended)

**Dashboard Reset Buttons:**
- **"Reset Sync"** (yellow button) - Resets all blog sync states
- **"Reset"** (small yellow button on each blog card) - Resets individual blog sync state

**Blog Settings Reset Button:**
- **"Reset Sync"** (yellow button) - Resets sync state for current blog
- Located next to "Sync Now" and "Disconnect" buttons

**Locations:** 
- Dashboard > Evernote Integration section
- Blog Settings > Evernote Notebook section

**Usage:**

*Reset All Blogs:*
1. Navigate to your dashboard
2. Click "Reset Sync" next to "Sync All Blogs" button
3. Confirm the reset action
4. All blog sync states will be cleared

*Reset Individual Blog:*
- **From Dashboard:** Click small "Reset" button on blog card
- **From Blog Settings:** Click "Reset Sync" button in Evernote section
- Confirm the reset action
- Only that blog's sync state will be cleared

### 2. API Endpoints

**Reset All Blogs:**
```
POST /api/admin/reset-all-sync-states
```

**Reset Single Blog:**
```
POST /api/blogs/[blogId]/reset-sync
```

### 3. Command Line Script

**Fixed Script:** `./reset-sync.sh`
- Now properly handles authentication errors
- Shows clear success/failure messages
- Recommends using web interface if unauthorized

**Usage:**
```bash
./reset-sync.sh
```

## Sync Status Visibility

### Dashboard Blog Cards
Shows for each connected blog:
```
Last synced: Never
Last attempt: 2h ago (if failed)
[Sync Now] [Reset] buttons
```

### Blog Settings Page
Detailed sync information:
```
Sync Status
Last successful sync: Never
Last attempt: 2 hours ago (failed)
Sync state: 130551
```

## When to Reset Sync State

**Reset sync state when:**
- Sync shows "No changes detected" but you know there are changes
- Previous syncs failed due to rate limits and you want to retry
- Sync appears stuck or not progressing
- You want to force a fresh full sync

**After reset:**
- Next sync will be a complete fresh sync
- System will process all notes in the notebook again (rate-limited)
- Sync state tracking starts fresh

## Current Sync Behavior

**Before Reset:**
```
❌ Current: 130551, Last: 130551 → Skips sync (incorrectly)
```

**After Reset:**
```
✅ No previous successful sync → Proceeds with fresh sync
✅ Only compares against successful sync states
✅ Failed attempts don't block future syncs
```

The system now correctly handles sync state tracking and provides multiple ways to reset when needed.