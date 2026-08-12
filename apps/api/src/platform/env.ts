import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(3).optional(),
  S3_PRESIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900)
});

const parsed = envSchema.parse(process.env);

if (parsed.NODE_ENV === 'production' && !parsed.JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET must be configured in production.');
}

if (parsed.NODE_ENV === 'production' && !parsed.S3_BUCKET) {
  throw new Error('S3_BUCKET must be configured in production.');
}

export const env = parsed;

export function accessTokenSecret() {
  return env.JWT_ACCESS_SECRET ?? 'local-development-only-change-this-secret-32';
}
