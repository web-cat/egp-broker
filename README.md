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

