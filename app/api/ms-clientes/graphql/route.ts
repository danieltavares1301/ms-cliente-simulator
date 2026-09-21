import { productionGraphqlCallbackHandler } from '../../../../src/graphql/production';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(request: Request): Promise<Response> {
  return productionGraphqlCallbackHandler(request);
}
