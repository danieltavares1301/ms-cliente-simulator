import { describe, expect, it, vi } from 'vitest';

describe('Neon runtime database factory', () => {
  it(
    'does not connect or require environment variables during module import',
    async () => {
    vi.resetModules();

    await expect(import('./runtime')).resolves.toMatchObject({
      createRunDatabase: expect.any(Function),
    });
    },
    15_000,
  );
});
