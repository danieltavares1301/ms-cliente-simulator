import { NextResponse } from 'next/server';

import {
  paginationQuerySchema,
  scenarioListResponseSchema,
} from '../../../../src/contracts';
import {
  scenarioCatalog,
  toScenarioMetadata,
} from '../../../../src/scenarios/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function invalidQueryResponse(): Response {
  return NextResponse.json(
    {
      error: {
        code: 'INVALID_QUERY',
        message: 'Invalid query parameters',
        requestId: `req_${crypto.randomUUID()}`,
      },
    },
    { status: 422 },
  );
}

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const query = paginationQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!query.success) return invalidQueryResponse();

  const { page, pageSize, tag, scope } = query.data;
  const filtered = scenarioCatalog
    .listActive()
    .filter((scenario) => !tag || scenario.tags.includes(tag))
    .filter((scenario) => !scope || scenario.scope === scope);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const body = scenarioListResponseSchema.parse({
    data: filtered.slice(start, start + pageSize).map(toScenarioMetadata),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });

  return NextResponse.json(body);
}
