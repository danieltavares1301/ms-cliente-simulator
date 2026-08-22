import { productionRunApiHandlers } from '../../../../../../src/runs/production';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { runId } = await context.params;
  return productionRunApiHandlers.cancelRun(request, runId);
}
