import { productionGraphqlCallbackHandler } from '../../../../src/graphql/production';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return productionGraphqlCallbackHandler(request);
}
