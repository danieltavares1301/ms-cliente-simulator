import { z } from 'zod';

export const GRAPHQL_CALLBACK_AUTH_MODES = [
  'SHARED_SECRET',
  'AZURE_BEARER_STRUCTURAL',
] as const;

export type GraphqlCallbackAuthMode =
  (typeof GRAPHQL_CALLBACK_AUTH_MODES)[number];

const serverEnvironmentKeys = [
  'APP_ENV',
  'TARGET_ENV',
  'TARGET_SALESFORCE_BASE_URL',
  'TARGET_SALESFORCE_ORG_ID',
  'DATABASE_URL',
  'QSTASH_URL',
  'ORCHESTRATION_ENABLED',
  'AZURE_TOKEN_SIMULATOR_ENABLED',
  'GRAPHQL_CALLBACK_ENABLED',
  'GRAPHQL_CALLBACK_AUTH_MODE',
  'SALESFORCE_DISPATCH_ENABLED',
  'SALESFORCE_TEST_DATA_ENABLED',
  'SIMULATOR_ADMIN_API_KEY',
  'GRAPHQL_CALLBACK_SHARED_SECRET',
  'IDEMPOTENCY_HASH_PEPPER',
  'PUBLIC_APP_BASE_URL',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'SALESFORCE_CLIENT_ID',
  'SALESFORCE_CLIENT_SECRET',
  'SALESFORCE_TOKEN_URL',
] as const;

const serverEnvironmentKeySet = new Set<string>(serverEnvironmentKeys);

function isGraphqlCallbackAuthMode(
  value: string,
): value is GraphqlCallbackAuthMode {
  return (GRAPHQL_CALLBACK_AUTH_MODES as readonly string[]).includes(value);
}

export function parseGraphqlCallbackAuthMode(
  value: string | undefined,
): GraphqlCallbackAuthMode | undefined {
  if (value === undefined || value === '') {
    return 'SHARED_SECRET';
  }

  return isGraphqlCallbackAuthMode(value) ? value : undefined;
}

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

const salesforceTokenUrlSchema = z.string().transform((value, context) => {
  const url = parseUrl(value);

  if (
    url === undefined ||
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    value.includes('?') ||
    value.includes('#') ||
    url.pathname !== '/services/oauth2/token'
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Invalid secure URL',
    });
    return z.NEVER;
  }

  return url.toString();
});

const orchestrationOnlyKeys = [
  'SIMULATOR_ADMIN_API_KEY',
  'IDEMPOTENCY_HASH_PEPPER',
  'PUBLIC_APP_BASE_URL',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
] as const;

const salesforceDispatchOnlyKeys = [
  'SALESFORCE_CLIENT_ID',
  'SALESFORCE_CLIENT_SECRET',
  'SALESFORCE_TOKEN_URL',
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
    AZURE_TOKEN_SIMULATOR_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    GRAPHQL_CALLBACK_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    GRAPHQL_CALLBACK_AUTH_MODE: z.string().optional(),
    SALESFORCE_DISPATCH_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SALESFORCE_TEST_DATA_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SIMULATOR_ADMIN_API_KEY: z.string().optional(),
    GRAPHQL_CALLBACK_SHARED_SECRET: z.string().optional(),
    IDEMPOTENCY_HASH_PEPPER: z.string().optional(),
    PUBLIC_APP_BASE_URL: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
    SALESFORCE_CLIENT_ID: z.string().optional(),
    SALESFORCE_CLIENT_SECRET: z.string().optional(),
    SALESFORCE_TOKEN_URL: z.string().optional(),
  })
  .superRefine((configuration, context) => {
    const graphqlCallbackAuthMode = parseGraphqlCallbackAuthMode(
      configuration.GRAPHQL_CALLBACK_AUTH_MODE,
    );

    if (
      configuration.AZURE_TOKEN_SIMULATOR_ENABLED &&
      !configuration.ORCHESTRATION_ENABLED
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AZURE_TOKEN_SIMULATOR_ENABLED'],
        message: 'Azure token simulator requires ORCHESTRATION_ENABLED=true',
      });
    }

    if (
      configuration.GRAPHQL_CALLBACK_ENABLED &&
      !configuration.ORCHESTRATION_ENABLED
    ) {
      context.addIssue({
        code: 'custom',
        path: ['GRAPHQL_CALLBACK_ENABLED'],
        message: 'GraphQL callback requires ORCHESTRATION_ENABLED=true',
      });
    }

    if (
      configuration.SALESFORCE_DISPATCH_ENABLED &&
      !configuration.ORCHESTRATION_ENABLED
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SALESFORCE_DISPATCH_ENABLED'],
        message: 'Real Salesforce dispatch requires ORCHESTRATION_ENABLED=true',
      });
    }

    if (
      configuration.SALESFORCE_TEST_DATA_ENABLED &&
      (!configuration.ORCHESTRATION_ENABLED ||
        !configuration.SALESFORCE_DISPATCH_ENABLED)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SALESFORCE_TEST_DATA_ENABLED'],
        message:
          'Salesforce test data requires orchestration and real dispatch',
      });
    }

    if (
      configuration.GRAPHQL_CALLBACK_ENABLED &&
      graphqlCallbackAuthMode === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['GRAPHQL_CALLBACK_AUTH_MODE'],
        message: 'Invalid GraphQL callback auth mode',
      });
    }

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
      (configuration.AZURE_TOKEN_SIMULATOR_ENABLED ||
        (configuration.GRAPHQL_CALLBACK_ENABLED &&
          graphqlCallbackAuthMode === 'SHARED_SECRET')) &&
      configuration.GRAPHQL_CALLBACK_SHARED_SECRET !== undefined &&
      configuration.GRAPHQL_CALLBACK_SHARED_SECRET.length < 32
    ) {
      context.addIssue({
        code: 'custom',
        path: ['GRAPHQL_CALLBACK_SHARED_SECRET'],
        message: 'Secret is too short',
      });
    }

    if (
      configuration.AZURE_TOKEN_SIMULATOR_ENABLED &&
      (configuration.GRAPHQL_CALLBACK_SHARED_SECRET === undefined ||
        configuration.GRAPHQL_CALLBACK_SHARED_SECRET === '')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['GRAPHQL_CALLBACK_SHARED_SECRET'],
        message: 'Required when Azure token simulator is enabled',
      });
    }

    if (
      configuration.GRAPHQL_CALLBACK_ENABLED &&
      graphqlCallbackAuthMode === 'SHARED_SECRET' &&
      (configuration.GRAPHQL_CALLBACK_SHARED_SECRET === undefined ||
        configuration.GRAPHQL_CALLBACK_SHARED_SECRET === '')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['GRAPHQL_CALLBACK_SHARED_SECRET'],
        message: 'Required when GraphQL callback is enabled',
      });
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

    if (!configuration.SALESFORCE_DISPATCH_ENABLED) {
      return;
    }

    for (const variableName of salesforceDispatchOnlyKeys) {
      const value = configuration[variableName];
      if (value === undefined || value === '') {
        context.addIssue({
          code: 'custom',
          path: [variableName],
          message: 'Required when real Salesforce dispatch is enabled',
        });
      }
    }

    for (const variableName of [
      'SALESFORCE_CLIENT_ID',
      'SALESFORCE_CLIENT_SECRET',
    ] as const) {
      const value = configuration[variableName];
      if (value !== undefined && value.length < 15) {
        context.addIssue({
          code: 'custom',
          path: [variableName],
          message: 'Secret is too short',
        });
      }
    }

    if (
      configuration.SALESFORCE_TOKEN_URL !== undefined &&
      !salesforceTokenUrlSchema.safeParse(configuration.SALESFORCE_TOKEN_URL)
        .success
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SALESFORCE_TOKEN_URL'],
        message: 'Invalid secure URL',
      });
    }
    if (configuration.SALESFORCE_TOKEN_URL !== undefined) {
      const tokenUrl = parseUrl(configuration.SALESFORCE_TOKEN_URL);
      const targetUrl = parseUrl(configuration.TARGET_SALESFORCE_BASE_URL);
      if (
        tokenUrl !== undefined &&
        targetUrl !== undefined &&
        tokenUrl.host !== targetUrl.host &&
        tokenUrl.host !== 'test.salesforce.com'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['SALESFORCE_TOKEN_URL'],
          message: 'Salesforce OAuth host is not authorized',
        });
      }
    }
  })
  .transform((configuration) => {
    const graphqlCallbackAuthMode =
      parseGraphqlCallbackAuthMode(configuration.GRAPHQL_CALLBACK_AUTH_MODE) ??
      'SHARED_SECRET';

    if (!configuration.ORCHESTRATION_ENABLED) {
      return {
        APP_ENV: configuration.APP_ENV,
        TARGET_ENV: configuration.TARGET_ENV,
        TARGET_SALESFORCE_BASE_URL: configuration.TARGET_SALESFORCE_BASE_URL,
        TARGET_SALESFORCE_ORG_ID: configuration.TARGET_SALESFORCE_ORG_ID,
        DATABASE_URL: configuration.DATABASE_URL,
        QSTASH_URL: configuration.QSTASH_URL,
        ORCHESTRATION_ENABLED: false as const,
        AZURE_TOKEN_SIMULATOR_ENABLED: false as const,
        GRAPHQL_CALLBACK_ENABLED: false as const,
        SALESFORCE_DISPATCH_ENABLED: false as const,
        SALESFORCE_TEST_DATA_ENABLED: false as const,
      };
    }

    if (!configuration.SALESFORCE_DISPATCH_ENABLED) {
      return {
        ...configuration,
        ORCHESTRATION_ENABLED: true as const,
        AZURE_TOKEN_SIMULATOR_ENABLED:
          configuration.AZURE_TOKEN_SIMULATOR_ENABLED,
        GRAPHQL_CALLBACK_ENABLED: configuration.GRAPHQL_CALLBACK_ENABLED,
        GRAPHQL_CALLBACK_AUTH_MODE: graphqlCallbackAuthMode,
        SALESFORCE_DISPATCH_ENABLED: false as const,
        SALESFORCE_TEST_DATA_ENABLED: false as const,
        PUBLIC_APP_BASE_URL: securePublicUrlSchema.parse(
          configuration.PUBLIC_APP_BASE_URL,
        ),
        ...(configuration.GRAPHQL_CALLBACK_ENABLED &&
        graphqlCallbackAuthMode === 'SHARED_SECRET'
          ? {
              GRAPHQL_CALLBACK_SHARED_SECRET:
                configuration.GRAPHQL_CALLBACK_SHARED_SECRET!,
            }
          : {}),
      };
    }

    return {
      ...configuration,
      ORCHESTRATION_ENABLED: true as const,
      AZURE_TOKEN_SIMULATOR_ENABLED:
        configuration.AZURE_TOKEN_SIMULATOR_ENABLED,
      GRAPHQL_CALLBACK_ENABLED: configuration.GRAPHQL_CALLBACK_ENABLED,
      GRAPHQL_CALLBACK_AUTH_MODE: graphqlCallbackAuthMode,
      SALESFORCE_DISPATCH_ENABLED: true as const,
      SALESFORCE_TEST_DATA_ENABLED: configuration.SALESFORCE_TEST_DATA_ENABLED,
      PUBLIC_APP_BASE_URL: securePublicUrlSchema.parse(
        configuration.PUBLIC_APP_BASE_URL,
      ),
      SALESFORCE_TOKEN_URL: salesforceTokenUrlSchema.parse(
        configuration.SALESFORCE_TOKEN_URL,
      ),
      ...(configuration.GRAPHQL_CALLBACK_ENABLED &&
      graphqlCallbackAuthMode === 'SHARED_SECRET'
        ? {
            GRAPHQL_CALLBACK_SHARED_SECRET:
              configuration.GRAPHQL_CALLBACK_SHARED_SECRET!,
          }
        : {}),
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
    | {
        ORCHESTRATION_ENABLED: false;
        AZURE_TOKEN_SIMULATOR_ENABLED: false;
        GRAPHQL_CALLBACK_ENABLED: false;
        SALESFORCE_DISPATCH_ENABLED: false;
        SALESFORCE_TEST_DATA_ENABLED: false;
      }
    | {
        ORCHESTRATION_ENABLED: true;
        AZURE_TOKEN_SIMULATOR_ENABLED: boolean;
        GRAPHQL_CALLBACK_ENABLED: boolean;
        GRAPHQL_CALLBACK_AUTH_MODE: GraphqlCallbackAuthMode;
        SALESFORCE_DISPATCH_ENABLED: false;
        SALESFORCE_TEST_DATA_ENABLED: false;
        SIMULATOR_ADMIN_API_KEY: string;
        GRAPHQL_CALLBACK_SHARED_SECRET?: string;
        IDEMPOTENCY_HASH_PEPPER: string;
        PUBLIC_APP_BASE_URL: string;
        QSTASH_TOKEN: string;
        QSTASH_CURRENT_SIGNING_KEY: string;
        QSTASH_NEXT_SIGNING_KEY: string;
      }
    | {
        ORCHESTRATION_ENABLED: true;
        AZURE_TOKEN_SIMULATOR_ENABLED: boolean;
        GRAPHQL_CALLBACK_ENABLED: boolean;
        GRAPHQL_CALLBACK_AUTH_MODE: GraphqlCallbackAuthMode;
        SALESFORCE_DISPATCH_ENABLED: true;
        SALESFORCE_TEST_DATA_ENABLED: boolean;
        SIMULATOR_ADMIN_API_KEY: string;
        GRAPHQL_CALLBACK_SHARED_SECRET?: string;
        IDEMPOTENCY_HASH_PEPPER: string;
        PUBLIC_APP_BASE_URL: string;
        QSTASH_TOKEN: string;
        QSTASH_CURRENT_SIGNING_KEY: string;
        QSTASH_NEXT_SIGNING_KEY: string;
        SALESFORCE_CLIENT_ID: string;
        SALESFORCE_CLIENT_SECRET: string;
        SALESFORCE_TOKEN_URL: string;
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
