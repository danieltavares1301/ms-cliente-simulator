import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import { parseServerEnvironment } from '../config/server-env';
import { DrizzleRunRepository } from './drizzle-run-repository';
import * as schema from './schema';

export function createRunDatabase(
  environment: Record<string, string | undefined> = process.env,
) {
  if (typeof window !== 'undefined') {
    throw new Error('Run database is server-only');
  }

  const configuration = parseServerEnvironment(environment);
  if (!configuration.ORCHESTRATION_ENABLED) {
    throw new Error('Orchestration is disabled');
  }

  return drizzle(neon(configuration.DATABASE_URL), { schema });
}

export function createRunRepository(
  environment: Record<string, string | undefined> = process.env,
): DrizzleRunRepository {
  return new DrizzleRunRepository(createRunDatabase(environment));
}
