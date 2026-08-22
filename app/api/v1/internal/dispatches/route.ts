import { productionDispatchHandler } from '../../../../../src/runs/production-dispatch';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return productionDispatchHandler(request);
}
