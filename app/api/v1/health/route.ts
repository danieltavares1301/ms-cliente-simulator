import { NextResponse } from 'next/server';

import { createHealthResponse } from '@/src/health';

export const runtime = 'nodejs';

export function GET(): Response {
  return NextResponse.json(createHealthResponse());
}
