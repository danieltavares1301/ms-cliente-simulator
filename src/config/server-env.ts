import { z } from 'zod';

const serverEnvironmentKeys = [
  'APP_ENV',
  'TARGET_ENV',
  'TARGET_SALESFORCE_BASE_URL',
  'TARGET_SALESFORCE_ORG_ID',
  'DATABASE_URL',
  'QSTASH_URL',
] as const;

const serverEnvironmentKeySet = new Set<string>(serverEnvironmentKeys);

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function normalizeTrailingSlash(url: URL): string {
  return url.toString().replace(/\/+$/, '');
}

const salesforceUrlSchema = z.string().transform((value, context) => {
  const url = parseUrl(value);

  if (
    url === undefined ||
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    value.includes('?') ||
    value.includes('#')
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Invalid secure URL',
    });
    return z.NEVER;
  }

  return normalizeTrailingSlash(url);
});

const databaseUrlSchema = z.string().transform((value, context) => {
  const url = parseUrl(value);

  if (
    url === undefined ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.password === ''
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Invalid database URL',
    });
    return z.NEVER;
  }

  return value;
});

const qstashUrlSchema = z.string().transform((value, context) => {
  const url = parseUrl(value);

  if (
    url === undefined ||
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    value.includes('?') ||
    value.includes('#')
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Invalid secure URL',
    });
    return z.NEVER;
  }

  return normalizeTrailingSlash(url);
});

const serverEnvironmentSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TARGET_ENV: z.literal('mrv-devDan'),
  TARGET_SALESFORCE_BASE_URL: salesforceUrlSchema,
  TARGET_SALESFORCE_ORG_ID: z.literal('00DHZ000006mzDp2AI'),
  DATABASE_URL: databaseUrlSchema,
  QSTASH_URL: qstashUrlSchema,
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export class ServerEnvironmentError extends Error {
  readonly invalidVariables: readonly string[];

  constructor(invalidVariables: readonly string[]) {
    super(
      `Invalid server environment variables: ${invalidVariables.join(', ')}`,
    );
    this.name = 'ServerEnvironmentError';
    this.invalidVariables = invalidVariables;
  }
}

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const invalidVariables = [
      ...new Set(
        result.error.issues
          .map((issue) => issue.path[0])
          .filter(
            (variableName): variableName is string =>
              typeof variableName === 'string' &&
              serverEnvironmentKeySet.has(variableName),
          ),
      ),
    ];

    throw new ServerEnvironmentError(invalidVariables);
  }

  return result.data;
}
