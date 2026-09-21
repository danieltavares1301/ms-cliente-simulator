import { describe, expect, it } from 'vitest';

import { maxDuration, runtime } from './route';

describe('ms-clientes graphql route exports', () => {
  it('pins the Node runtime and a maxDuration that covers delayed callback scenarios', () => {
    expect(runtime).toBe('nodejs');
    expect(maxDuration).toBe(15);
  });
});
