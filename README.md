# EGP-Broker LTI Tool Server

## Local Development

### Run all (LTI Tool UI, LTI Sever, Database, DB Manager)

```bash
docker compose up
```

### Key URLs

| Service    | URL |
| -------- | ------- |
| [egp-lti](http://localhost:3000) | [localhost:3000](http://localhost:3000) |
| [Database (MongoDB)](http://localhost:27017) | [localhost:27017](http://localhost:27017) |
| [DB Manager (Mongo Express)](http://localhost:8081) | [localhost:8081](http://localhost:8081) |

## Deploy

Publish EGP-Broker LTI Tool production image to [`version.cs.vt.edu`](https://version.cs.vt.edu/stedwar2/egp-broker/container_registry)

1. Edit the .env file to set the docker username and password

    ```.env
    DOCKER_USERNAME=username
    DOCKER_PASSWORD=password
    ```

2. Run `publish.sh` script to build and push image

    ```bash
    ./publish.sh
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
                        "target_link_uri": "https://egp-broker.cs.vt.edu"
                    }
                ]
            },
            "privacy_level": "public"
        }
    ],
    "public_jwk": {},
    "description": "epg-broker",
    "custom_fields": {
        "canvas_user_id": "$Canvas.user.id",
        "canvas_course_id": "$Canvas.course.id"
    },
    "public_jwk_url": "https://egp-broker.cs.vt.edu/keys",
    "target_link_uri": "https://egp-broker.cs.vt.edu",
    "oidc_initiation_url": "https://egp-broker.cs.vt.edu/login"
}
```
