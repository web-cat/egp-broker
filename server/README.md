# EGP-Broker LTI 1.3 Server

> If you make a change to 

## FAQ
- What data can I get from Canvas?
    -  https://canvas.instructure.com/doc/api/file.tools_variable_substitutions.html

## API Reference

### Course

```http
  GET /api/course/{course_lti_id}
```

```http
  GET /api/course/{course_lti_id}/students
```

```http
  GET /api/course/{course_lti_id}/assignments
```

```http
  GET /api/course/{course_lti_id}/stats
```

```http
  POST /api/course/add
```

### Student

```http
  GET /api/student?course={course_lti_id}
````

```json
{
  "title": "lti-test",
  "scopes": [
    "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
    "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
    "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
    "https://purl.imsglobal.org/spec/lti-ags/scope/score",
    "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
    "https://canvas.instructure.com/lti/public_jwk/scope/update",
    "https://canvas.instructure.com/lti/account_lookup/scope/show",
    "https://canvas.instructure.com/lti-ags/progress/scope/show",
    "https://canvas.instructure.com/lti/page_content/show"
  ],
  "extensions": [
    {
      "platform": "canvas.instructure.com",
      "settings": {
        "platform": "canvas.instructure.com",
        "placements": [
          {
            "placement": "course_navigation",
            "message_type": "LtiResourceLinkRequest",
            "target_link_uri": "https://one-sunbeam-distinctly.ngrok-free.app"
          }
        ]
      },
      "privacy_level": "public"
    }
  ],
  "public_jwk": {},
  "description": "lti-test",
  "custom_fields": {},
  "public_jwk_url": "https://one-sunbeam-distinctly.ngrok-free.app/keys",
  "target_link_uri": "https://one-sunbeam-distinctly.ngrok-free.app",
  "oidc_initiation_url": "https://one-sunbeam-distinctly.ngrok-free.app/login"
}
```

## Roadmap
- com.instructure.User.student_view
