import { productionContestacaoInsertCallbackHandler } from '../../../../src/ms-clientes/contestacao-insert-production';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return productionContestacaoInsertCallbackHandler(request);
}
