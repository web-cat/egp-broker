 
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const DB_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:P@ssw0rd@postgres:5432/test_database'

async function globalSetup() {
  console.log('🗄️  E2E Setup: Resetting test database...')

  try {
    // Set environment variable for all commands
    process.env.NUXT_DATABASE_URL = DB_URL

    // Step 1: Generate Prisma client
    console.log('  → Generating Prisma client...')
    await execAsync('pnpm prisma generate')

    // Step 2: Reset database (without auto-seed)
    console.log('  → Resetting database...')
    await execAsync(`NUXT_DATABASE_URL=${DB_URL} pnpm prisma db push --force-reset`)

    // Step 3: Run seeder manually with pnpm
    console.log('  → Seeding database...')
    await execAsync(`NUXT_DATABASE_URL=${DB_URL} pnpm exec tsx prisma/seed.ts`)

    console.log('✅ E2E Setup: Ready')
  } catch (error) {
    console.error('❌ E2E Setup failed:', error)
    throw error
  }
}

export default globalSetup
