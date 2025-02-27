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
