import { createPacCreditoCallbackHandler } from './pac-credito-handler';

export const productionPacCreditoCallbackHandler =
  createPacCreditoCallbackHandler({
    environment: process.env,
  });
