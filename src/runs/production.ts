import { createRunRepository } from '../db/runtime';
import { createRunApiHandlers } from './handlers';

export const productionRunApiHandlers = createRunApiHandlers({
  environment: process.env,
  repositoryFactory: () => createRunRepository(process.env),
});
