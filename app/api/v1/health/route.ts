import { NextResponse } from 'next/server';

import { createHealthResponse } from '../../../../src/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): Response {
  try {
    return NextResponse.json(createHealthResponse(process.env));
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Service configuration is invalid',
          requestId: `req_${crypto.randomUUID()}`,
        },
      },
      { status: 500 },
    );
  }
}
