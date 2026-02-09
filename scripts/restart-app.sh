# Local script to trigger a restart of the Nuxt dev server inside the container
echo "🔄 Triggering application restart..."
docker compose exec app-dev pnpm run restart 2>&1 > /dev/null
echo "✅ Restart signal sent. Check container logs for progress."
