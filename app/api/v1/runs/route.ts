import { productionRunApiHandlers } from '../../../../src/runs/production';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return productionRunApiHandlers.listRuns(request);
}

export function POST(request: Request): Promise<Response> {
  return productionRunApiHandlers.createRun(request);
}
