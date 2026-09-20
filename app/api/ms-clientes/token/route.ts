import { productionAzureTokenSimulatorHandler } from '../../../../src/ms-clientes/token-production';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return productionAzureTokenSimulatorHandler(request);
}
