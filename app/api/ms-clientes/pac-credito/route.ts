import { productionPacCreditoCallbackHandler } from '../../../../src/ms-clientes/pac-credito-production';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return productionPacCreditoCallbackHandler(request);
}
