import { closePool, migrate } from '../db/client.js'
import { seedDatabase } from '../db/seed.js'

await migrate()
await seedDatabase()
await closePool()

console.log('FakeMart database initialized.')
