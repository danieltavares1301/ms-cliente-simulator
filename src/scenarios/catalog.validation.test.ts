import { describe, expect, it } from 'vitest';

import { scenarioDefinitionSchema } from '../contracts';
import { scenarioCatalog } from './catalog';

describe('scenario catalog build validation', () => {
  it('imports and validates every versioned definition', () => {
    const definitions = scenarioCatalog.listAll();

    expect(definitions).toHaveLength(26);
    for (const definition of definitions) {
      expect(() => scenarioDefinitionSchema.parse(definition)).not.toThrow();
    }
  });
});
