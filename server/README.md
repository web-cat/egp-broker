# Demo LTI 1.3 Server

> Server is build up from ltijs server example

### Usage

- Download or clone the repo

- Setup `.env` file with the relevant variables (copy `example.env` rename it to `.env` and fill out the variables)

  ```
  DB_HOST=localhost
  DB_NAME=ltidb
  DB_USER=user
  DB_PASS=pass
  LTI_KEY=LTIKEY
  ```
  *DB_USER and DB_PASS are not required*

- Run `npm install`

- Run `npm start` 

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
