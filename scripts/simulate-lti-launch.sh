#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000"
ENDPOINT="/api/dev/mock-launch"
COOKIE_FILE="lti-session.cookie"

# Payload for the admin user in CS 101
PAYLOAD='{
  "email": "admin@example.com",
  "courseId": "course-101",
  "courseTitle": "Introduction to Computer Science",
  "courseLabel": "CS 101",
  "role": "TEACHER"
}'

echo "🚀 Simulating LTI 1.3 Launch for Admin in CS 101..."

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
  echo ""
  echo "💡 You can now use this session to test other endpoints, e.g.:"
  echo "   curl -b $COOKIE_FILE $BASE_URL/api/me/enrollment"
else
  echo "❌ Launch Failed!"
  echo "Response: $RESPONSE"
  exit 1
fi
