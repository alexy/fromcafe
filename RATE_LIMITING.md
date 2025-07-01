# Evernote Rate Limiting Optimization

## Why You Were Hitting Rate Limits

During the first full sync, the system was making an excessive number of API calls:

### Original Behavior:
- **getSyncState()**: 1 call (ACCOUNT-WIDE, not notebook-specific)
- **findNotesMetadata()**: 1 call (✅ correctly scoped to notebook)
- **getNote()**: 1 call per note (up to 100 notes)
- **getTag()**: 1 call per tag per note

**Example**: 50 notes with 3 tags each = 1 + 1 + 50 + 150 = **202 API calls** in rapid succession.

### Key Issue Discovered:
`getSyncState()` returns sync information for the **entire Evernote account**, not just the connected notebook. This means the optimization wasn't as targeted as initially thought.

## Optimizations Implemented

### 1. Rate-Limited Note Processing
- Added 500ms delay between `getNote()` calls
- Process notes sequentially instead of in parallel
- Reduced initial sync limit to 10 notes maximum

### 2. Tag Caching
- Cache tag names after first fetch to avoid duplicate API calls
- Added 100ms delay between tag requests
- Dramatically reduces API calls for notes with shared tags

### 3. Smart Sync Strategy
- **Full Sync**: First sync limited to 10 notes to avoid rate limits
- **Incremental Sync**: Uses date filters to only fetch modified notes
- **Account-wide optimization**: Still uses `getSyncState()` as a broad optimization

### 4. Date-Based Filtering
- Added `sinceDate` parameter to `getNotesFromNotebook()`
- Subsequent syncs only fetch notes modified since last successful sync
- Reduces API calls by skipping unchanged notes

### 5. Improved Error Messages
- Clear explanation that rate limits are normal for first sync
- Shows estimated wait time based on Evernote's response
- Automatic retry via scheduled sync

## Current Sync Behavior

### First Sync (rate-limited):
- Processes up to 10 notes
- 500ms delay between notes
- Tag caching reduces duplicate calls
- Estimated time: ~5-10 seconds for 10 notes

### Subsequent Syncs:
- Uses getSyncState() to check if sync needed
- Only syncs if changes detected
- Much faster as most content already cached

## User Experience

1. **First sync**: May only sync 10 notes initially
2. **Automatic retries**: Scheduler runs every 15 minutes to sync remaining notes
3. **Progressive sync**: Each sync processes another batch until complete
4. **Rate limit errors**: Now show helpful message with wait time

## Manual Sync Strategy

For notebooks with many notes:
1. First manual sync: Gets first 10 notes
2. Wait 15-60 minutes for rate limits to reset
3. Click "Sync Now" again to get next batch
4. Repeat until all notes synced

The system is now much more respectful of Evernote's API limits while still providing a good user experience.