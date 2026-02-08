#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000"
ENDPOINT="/api/dev/mock-launch"
COOKIE_FILE="lti-session-student.cookie"

# Payload for the demo user (student role in CS 101)
PAYLOAD='{
  "email": "demo@example.com",
  "courseId": "course-101",
  "courseTitle": "Introduction to Computer Science",
  "courseLabel": "CS 101",
  "role": "STUDENT"
}'

echo "🚀 Simulating LTI 1.3 Launch for Student in CS 101..."

# Perform the mock launch and save the session cookie
RESPONSE=$(curl -s -X POST "$BASE_URL$ENDPOINT" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_FILE" \
  -d "$PAYLOAD")

# Check if successful
if [[ $RESPONSE == *"success"* ]]; then
  echo "✅ Launch Successful!"
  echo "Response: $RESPONSE"
  echo "Session cookie saved to: $COOKIE_FILE"
else
  echo "❌ Launch Failed!"
  echo "Response: $RESPONSE"
  exit 1
fi
