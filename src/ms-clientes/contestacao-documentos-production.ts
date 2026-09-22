import { createContestacaoDocumentosCallbackHandler } from './contestacao-documentos-handler';

export const productionContestacaoDocumentosCallbackHandler =
  createContestacaoDocumentosCallbackHandler({
    environment: process.env,
  });
