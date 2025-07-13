#!/bin/bash

API_KEY="vwwLLYVmcBDnfPEntFVrDBN24rxNYZ2DwNPDPVEEmYwTYmW6vwacTAT827PL4CtW"
USER_ID="1"
COURSE_ID="4"
BASE_URL="https://canvas.endeavour.cs.vt.edu"

assignment_groups=$(curl -X GET "$BASE_URL/api/v1/courses/$COURSE_ID/assignment_groups" \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" | jq .)

for group in $(echo $assignment_groups | jq .[] | jq .id); do
  curl -X GET "$BASE_URL/api/v1/courses/$COURSE_ID/assignment_groups/$group/assignments" \
       -H "Authorization: Bearer $API_KEY" \
       -H "Content-Type: application/json" | jq .
done

# curl -X GET "$BASE_URL/api/v1/users/$USER_ID/courses/$COURSE_ID/assignments" \
#      -H "Authorization: Bearer $API_KEY" \
#      -H "Content-Type: application/json"

# # make a curl request to the canvas api to this url: https://canvas.endeavour.cs.vt.edu/api/v1/courses/4/assignments
# curl -X GET "$BASE_URL/api/v1/courses/$COURSE_ID/assignments" \
#      -H "Authorization: Bearer $API_KEY" \
#      -H "Content-Type: application/json"

# I want to compte the hash of of both responses
# curl -X GET "$BASE_URL/api/v1/users/$USER_ID/courses/$COURSE_ID/assignments" \
#      -H "Authorization: Bearer $API_KEY" \
#      -H "Content-Type: application/json" | jq .

# curl -X GET "$BASE_URL/api/v1/courses/$COURSE_ID/assignments" \
#      -H "Authorization: Bearer $API_KEY" \
#      -H "Content-Type: application/json" | jq .



