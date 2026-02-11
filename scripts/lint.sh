#!/bin/sh
# Local script to trigger a restart of the Nuxt dev server inside the container
docker compose exec app-dev pnpm run lint
