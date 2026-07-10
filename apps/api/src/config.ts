import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../../.env', import.meta.url) })
dotenv.config()

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'mysql://root:fakepass@127.0.0.1:3307/fakemart',
  port: Number(process.env.API_PORT ?? 4000),
  host: process.env.API_HOST ?? '0.0.0.0',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:10086')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-fakemart-secret'
}
