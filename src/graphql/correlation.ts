import type {
  AtualizarClienteInput,
  GraphqlResponsePolicy,
} from '../contracts';
import { graphqlResponsePolicySchema } from '../contracts';
import { createPepperedHash } from '../db/idempotency';
import type { CorrelatableRunMatch, Run } from '../db/run-repository';

export const DEFAULT_GRAPHQL_RESPONSE_POLICY: GraphqlResponsePolicy =
  'SUCCESS_200';
export const DEFAULT_DELAYED_RESPONSE_MS = 3_000;

export function normalizeCorrelationIdentifier(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === undefined || normalized.length === 0
    ? null
    : normalized;
}

export function createGraphqlCorrelationHashes(input: {
  cliente: Pick<AtualizarClienteInput, 'id' | 'idProspectSalesforce'>;
  pepper: string;
}) {
  const idClienteUpper = normalizeCorrelationIdentifier(input.cliente.id);
  const idProspectUpper = normalizeCorrelationIdentifier(
    input.cliente.idProspectSalesforce,
  );

  return {
    idClienteUpper,
    idProspectUpper,
    idClienteHash: createPepperedHash(idClienteUpper ?? '', input.pepper),
    idProspectHash: createPepperedHash(idProspectUpper ?? '', input.pepper),
    normalizedCorrelationKeyHash: createPepperedHash(
      `${idClienteUpper ?? ''}|${idProspectUpper ?? ''}`,
      input.pepper,
    ),
  };
}

export function resolveGraphqlResponsePolicy(run: Run | null | undefined) {
  const candidate = run?.variablesRedacted?.graphqlResponsePolicy;
  const parsed = graphqlResponsePolicySchema.safeParse(candidate);
  return parsed.success ? parsed.data : DEFAULT_GRAPHQL_RESPONSE_POLICY;
}

export function resolveGraphqlResponseDelayMs(
  run: Run | null | undefined,
): number {
  const candidate = run?.variablesRedacted?.graphqlResponseDelayMs;
  return typeof candidate === 'number' &&
    Number.isFinite(candidate) &&
    candidate >= 0
    ? candidate
    : DEFAULT_DELAYED_RESPONSE_MS;
}

export function summarizeCorrelation(match: CorrelatableRunMatch | null) {
  if (match === null) {
    return { correlated: false as const };
  }

  return {
    correlated: true as const,
    matchedBy: match.matchedBy,
    runId: match.run.id,
  };
}
