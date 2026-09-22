import { productionContestacaoDocumentosCallbackHandler } from '../../../../src/ms-clientes/contestacao-documentos-production';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return productionContestacaoDocumentosCallbackHandler(request);
}
