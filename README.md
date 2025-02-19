# egp-broker

## Local Development
### Run
#### Run all (Frontend, Backend, Database, DB Manager)
```bash
cd egp-broker
```

```bash
docker compose up
```

#### Run Backend Server, Database and DB Manager
```bash
cd egp-broker/backend
```

```bash
docker compose up
```

### Key URLs
| Service    | URL |
| -------- | ------- |
| Frontend (Svelte) | localhost:5173 |
| Backend (ExpressJS) | localhost:3001 |
| Database (MongoDB) | localhost:27017 |
| DB Manger (Mongo Express) | localhost:8081 |

### Seed Database
To populate the database with dummy data
```bash
curl -X POST localhost:3001/egp-broker-service/api/seed \
-H "Content-Type: application/json" \
-d '{
    "seedKey": "12345789"
}'
```

## Deploy
```bash
cd egp-broker
```

Edit the .env file to set the docker user name and password
```.env
DOCKER_USERNAME=username
DOCKER_PASSWORD=password
```

```bash
bash publish.sh
```

## LTI Key config
```json
{
    "title": "epg-broker",
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
    "description": "epg-broker",
    "custom_fields": {},
    "public_jwk_url": "https://one-sunbeam-distinctly.ngrok-free.app/keys",
    "target_link_uri": "https://one-sunbeam-distinctly.ngrok-free.app",
    "oidc_initiation_url": "https://one-sunbeam-distinctly.ngrok-free.app/login"
}
```

