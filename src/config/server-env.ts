import { z } from 'zod';

const serverEnvironmentKeys = [
  'APP_ENV',
  'TARGET_ENV',
  'TARGET_SALESFORCE_BASE_URL',
  'TARGET_SALESFORCE_ORG_ID',
  'DATABASE_URL',
  'QSTASH_URL',
  'ORCHESTRATION_ENABLED',
  'SIMULATOR_ADMIN_API_KEY',
  'IDEMPOTENCY_HASH_PEPPER',
  'PUBLIC_APP_BASE_URL',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
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

const securePublicUrlSchema = z.string().transform((value, context) => {
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

const orchestrationOnlyKeys = [
  'SIMULATOR_ADMIN_API_KEY',
  'IDEMPOTENCY_HASH_PEPPER',
  'PUBLIC_APP_BASE_URL',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
] as const;

const serverEnvironmentSchema = z
  .object({
    APP_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    TARGET_ENV: z.literal('mrv-devDan'),
    TARGET_SALESFORCE_BASE_URL: salesforceUrlSchema,
    TARGET_SALESFORCE_ORG_ID: z.literal('00DHZ000006mzDp2AI'),
    DATABASE_URL: databaseUrlSchema,
    QSTASH_URL: qstashUrlSchema,
    ORCHESTRATION_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SIMULATOR_ADMIN_API_KEY: z.string().optional(),
    IDEMPOTENCY_HASH_PEPPER: z.string().optional(),
    PUBLIC_APP_BASE_URL: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  })
  .superRefine((configuration, context) => {
    if (!configuration.ORCHESTRATION_ENABLED) {
      return;
    }

    for (const variableName of orchestrationOnlyKeys) {
      const value = configuration[variableName];
      if (value === undefined || value === '') {
        context.addIssue({
          code: 'custom',
          path: [variableName],
          message: 'Required when orchestration is enabled',
        });
      }
    }

    for (const variableName of [
      'SIMULATOR_ADMIN_API_KEY',
      'IDEMPOTENCY_HASH_PEPPER',
      'QSTASH_TOKEN',
      'QSTASH_CURRENT_SIGNING_KEY',
      'QSTASH_NEXT_SIGNING_KEY',
    ] as const) {
      const value = configuration[variableName];
      if (value !== undefined && value.length < 32) {
        context.addIssue({
          code: 'custom',
          path: [variableName],
          message: 'Secret is too short',
        });
      }
    }

    if (
      configuration.PUBLIC_APP_BASE_URL !== undefined &&
      !securePublicUrlSchema.safeParse(configuration.PUBLIC_APP_BASE_URL)
        .success
    ) {
      context.addIssue({
        code: 'custom',
        path: ['PUBLIC_APP_BASE_URL'],
        message: 'Invalid secure URL',
      });
    }
  })
  .transform((configuration) => {
    if (!configuration.ORCHESTRATION_ENABLED) {
      return {
        APP_ENV: configuration.APP_ENV,
        TARGET_ENV: configuration.TARGET_ENV,
        TARGET_SALESFORCE_BASE_URL: configuration.TARGET_SALESFORCE_BASE_URL,
        TARGET_SALESFORCE_ORG_ID: configuration.TARGET_SALESFORCE_ORG_ID,
        DATABASE_URL: configuration.DATABASE_URL,
        QSTASH_URL: configuration.QSTASH_URL,
        ORCHESTRATION_ENABLED: false as const,
      };
    }

    return {
      ...configuration,
      ORCHESTRATION_ENABLED: true as const,
      PUBLIC_APP_BASE_URL: securePublicUrlSchema.parse(
        configuration.PUBLIC_APP_BASE_URL,
      ),
    };
  });

type BaseServerEnvironment = {
  APP_ENV: 'development' | 'test' | 'production';
  TARGET_ENV: 'mrv-devDan';
  TARGET_SALESFORCE_BASE_URL: string;
  TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI';
  DATABASE_URL: string;
  QSTASH_URL: string;
};

export type ServerEnvironment = BaseServerEnvironment &
  (
    | { ORCHESTRATION_ENABLED: false }
    | {
        ORCHESTRATION_ENABLED: true;
        SIMULATOR_ADMIN_API_KEY: string;
        IDEMPOTENCY_HASH_PEPPER: string;
        PUBLIC_APP_BASE_URL: string;
        QSTASH_TOKEN: string;
        QSTASH_CURRENT_SIGNING_KEY: string;
        QSTASH_NEXT_SIGNING_KEY: string;
      }
  );

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

  return result.data as ServerEnvironment;
}
