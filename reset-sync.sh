#!/bin/bash

# Simple script to reset sync states for current user
echo "Calling reset sync states API..."

# Get response and store it
response=$(curl -X POST http://localhost:3000/api/admin/reset-all-sync-states \
  -H "Content-Type: application/json" \
  -s)

echo "Response:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

# Check if the response contains success
if echo "$response" | grep -q '"success":true'; then
  echo ""
  echo "✅ Reset complete! Check your dashboard to see the updated sync status."
else
  echo ""
  echo "❌ Reset failed. You need to be logged in to the app to use this endpoint."
  echo "   Please use the web interface instead."
fi