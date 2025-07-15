#!/bin/bash

# BASE_URL="https://opendsa-lti.localhost.devcom.vt.edu"

# curl -X POST $BASE_URL/egp_broker/student_extensions \
#   -H "Content-Type: application/json" \
#   -d '{
#     "student_extension": {
#       "user_email": "saketh@student.com",
#       "inst_chapter_module_id": 61,
#       "due_offset_hours": 48
#     }
#   }'




curl -X POST https://opendsa-lti.localhost.devcom.vt.edu/egp_broker/student_extensions \
  -H "Content-Type: application/json" \
  -d '{
    "student_extension": {
      "user_email": "saketh@student.com",
      "inst_chapter_module_id": 61,
      "due_offset_hours": 48
    }
  }'