# EGP-Broker LTI Tool Server

## Local Development

### Run all (LTI Tool UI, LTI Sever, Database, DB Manager)

```bash
docker compose up
```

### Update ENV Varibles
Update `./docker-compose.yaml` as needed. 
For most cases, only `LTI_KEY` and `CANVAS_CLIENT_ID` need to be updated 
(Admin -> VT -> Developer Keys).

```yaml
services:
  lti-server:
    ...
    environment:
      # LTI
      LTI_KEY: 2EB6yh826Rf4Wkmx47etctGtkrAn84rRF8PXcNxC62F3vv6crfVfP78WBX84YW9v

      # MongoDB
      DB_HOST: mongo-lti
      DB_USER: root
      DB_PASS: rootpassword
      DB_NAME_LTI: ltidb
      DB_NAME_EGP: egpdb

      # CANVAS
      CANVAS_URL: https://canvas.endeavour.cs.vt.edu
      CANVAS_NAME: endeavour.cs.vt
      CANVAS_CLIENT_ID: 10000000000007
      CANVAS_AUTH_ENDPOINT: https://canvas.endeavour.cs.vt.edu/api/lti/authorize_redirect
      CANVAS_ACCESS_TOKEN_ENDPOINT: https://canvas.endeavour.cs.vt.edu/login/oauth2/token
      CANVAS_JWK_URL: https://canvas.endeavour.cs.vt.edu/api/lti/security/jwks

      # OPENDSA
      # If you are running OpenDSA locally, the port should be set to 8443.
      # Make sure to add the port to the opendsa docker-compose.yaml file under opendsa-lti (OpenDSA-DevStack/docker-compose.yml).
      # The ports configuration should look like this:
      # - 8443:8443
      # Also, add 'config.hosts << "host.docker.internal"' to OpenDSA-DevStack/opendsa-lti/config/environments/development.rb.
      OPENDSA_URL: http://host.docker.internal:8443
      # NOTE: https://opendsa-lti.localhost.devcom.vt.edu will NOT work, because https://opendsa-lti.localhost.devcom.vt.edu is not known inside the container.

...
```

### Key URLs

| Service    | URL |
| -------- | ------- |
| [egp-lti](http://localhost:3000) | [localhost:3000](http://localhost:3000) |
| [Database (MongoDB)](http://localhost:27017) | [localhost:27017](http://localhost:27017) |
| [DB Manager (Mongo Express)](http://localhost:8081) | [localhost:8081](http://localhost:8081) |

## More Documentation

[Server Docs](./server/README.md)

[Frontend Docs](./frontend/README.md)

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
