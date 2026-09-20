import { createAzureTokenSimulatorHandler } from './token-handler';

export const productionAzureTokenSimulatorHandler =
  createAzureTokenSimulatorHandler({
    environment: process.env,
  });
