import { NextResponse } from 'next/server';

import { createHealthResponse } from '@/src/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return NextResponse.json(createHealthResponse(process.env));
}
