#!/bin/sh
# Simple loop to restart the dev server if it exits
# This allows HMR to persist while providing a way to hard-restart without container rebuilds
while true; do
  echo "🚀 Starting development server..."
  pnpm run dev
  echo "⚠️ Dev server exited. Restarting in 2 seconds..."
  sleep 2
done
