import { createContestacaoInsertCallbackHandler } from './contestacao-insert-handler';

export const productionContestacaoInsertCallbackHandler =
  createContestacaoInsertCallbackHandler({
    environment: process.env,
  });
