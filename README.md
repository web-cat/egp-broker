# egp-broker

## Local Development
### Run
#### Run all
```bash
cd egp-broker
```

```bash
docker compose up
```

#### Run Backend Server and Database
```bash
cd egp-broker/backend
```

```bash
docker compose up
```

### Key URLs
| Service    | URL |
| -------- | ------- |
| Frontend  | localhost:5173 |
| Backend  | localhost:3001 |
| Database  | localhost:27017 |
| DB Manger  | localhost:8081 |

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
```

