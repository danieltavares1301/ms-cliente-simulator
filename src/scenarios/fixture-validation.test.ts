import { describe, expect, it } from 'vitest';

import { validateRenderedFixtures } from '../../scripts/validate-fixtures';

describe('fixture build validation', () => {
  it('renders and validates all active READY fixtures', () => {
    const result = validateRenderedFixtures();

    expect(result.checked).toBe(19);
    expect(result.findings).toEqual([]);
  });
});
