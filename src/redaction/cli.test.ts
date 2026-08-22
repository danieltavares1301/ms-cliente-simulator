import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { runSanitizeExportCommand } from '../../scripts/sanitize-export';
import { validateFixtureDirectory } from '../../scripts/validate-fixtures';
import { renderScenarioFixture } from '../scenarios/renderer';
import { scanSecrets } from './scanner';

const sourceEmail = () =>
  ['entrada', 'corp', 'invalid'].join('@').replace('@corp@', '@corp.');

describe('offline secret sanitization commands', () => {
  it('preserves business data and removes secrets using only local-file dependencies', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const io = {
      readFile: vi.fn(async () =>
        JSON.stringify({
          nome: 'Maria da Silva',
          email: sourceEmail(),
          cpf: '52998224725',
          token: 'segredo',
        }),
      ),
      writeFile: vi.fn(async (path: string, content: string) =>
        writes.push({ path, content }),
      ),
      mkdir: vi.fn(async () => undefined),
    };

    const result = await runSanitizeExportCommand(
      ['D:\\exports\\raw.json', 'D:\\exports\\safe.json'],
      io,
    );

    expect(result).toEqual({
      inputPath: 'D:\\exports\\raw.json',
      outputPath: 'D:\\exports\\safe.json',
    });
    expect(io.readFile).toHaveBeenCalledTimes(1);
    expect(io.writeFile).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(1);
    expect(scanSecrets(JSON.parse(writes[0].content))).toEqual([]);
    expect(writes[0].content).toContain(sourceEmail());
    expect(writes[0].content).toContain('52998224725');
    expect(writes[0].content).not.toContain('segredo');
  });

  it('rejects URL input before any I/O, proving the command does not attempt network access', async () => {
    const io = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    };

    await expect(
      runSanitizeExportCommand(
        ['https://host.invalid/export.json', 'D:\\exports\\safe.json'],
        io,
      ),
    ).rejects.toThrow('caminho local explicito');
    expect(io.readFile).not.toHaveBeenCalled();
    expect(io.writeFile).not.toHaveBeenCalled();
    expect(io.mkdir).not.toHaveBeenCalled();
  });

  it.each([
    String.raw`\\server\share\export.json`,
    '//server/share/export.json',
    String.raw`\\?\C:\exports\raw.json`,
    String.raw`\\.\C:\exports\raw.json`,
  ])(
    'rejects Windows remote or device path %s before any I/O',
    async (inputPath) => {
      const io = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
      };

      await expect(
        runSanitizeExportCommand(
          [inputPath, String.raw`D:\exports\safe.json`],
          io,
        ),
      ).rejects.toThrow('caminho local explicito');
      expect(io.readFile).not.toHaveBeenCalled();
      expect(io.writeFile).not.toHaveBeenCalled();
      expect(io.mkdir).not.toHaveBeenCalled();
    },
  );

  it('rejects Windows remote fixture roots before probing the filesystem', async () => {
    const io = {
      exists: vi.fn(),
      listJsonFiles: vi.fn(),
      readFile: vi.fn(),
    };

    await expect(
      validateFixtureDirectory('//server/share/fixtures', io),
    ).rejects.toThrow('caminho local explicito');
    expect(io.exists).not.toHaveBeenCalled();
    expect(io.listJsonFiles).not.toHaveBeenCalled();
    expect(io.readFile).not.toHaveBeenCalled();
  });

  it('rejects fixture files that resolve outside the selected root without reading them', async () => {
    const io = {
      exists: vi.fn(async () => true),
      listJsonFiles: vi.fn(async () => [
        String.raw`D:\repo\fixtures\..\outside.json`,
      ]),
      readFile: vi.fn(),
    };

    await expect(
      validateFixtureDirectory(String.raw`D:\repo\fixtures`, io),
    ).rejects.toThrow('fora da raiz permitida');
    expect(io.readFile).not.toHaveBeenCalled();
  });

  it('returns a non-zero process exit code for a rejected remote path', () => {
    const script = fileURLToPath(
      new URL('../../scripts/sanitize-export.ts', import.meta.url),
    );
    const result = spawnSync(
      process.execPath,
      [script, 'https://host.invalid/export.json', 'D:\\exports\\safe.json'],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('caminho local explicito');
  });

  it('refuses input overwrite and output inside fixtures/raw before reading data', async () => {
    const io = { readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() };

    await expect(
      runSanitizeExportCommand(['D:\\x.json', 'D:\\x.json'], io),
    ).rejects.toThrow('sobrescrever o arquivo de entrada');
    await expect(
      runSanitizeExportCommand(
        ['D:\\x.json', 'D:\\repo\\fixtures\\raw\\x.json'],
        io,
      ),
    ).rejects.toThrow('fixtures/raw');
    expect(io.readFile).not.toHaveBeenCalled();
  });

  it('does not leak malformed payloads in errors', async () => {
    const malformed = ['{', 'conteudo-privado', ':'].join('');
    const io = {
      readFile: vi.fn(async () => malformed),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    };

    try {
      await runSanitizeExportCommand(
        ['D:\\exports\\raw.json', 'D:\\exports\\safe.json'],
        io,
      );
      throw new Error('esperava rejeicao');
    } catch (error) {
      expect(String(error)).toContain('JSON invalido');
      expect(String(error)).not.toContain(malformed);
    }
    expect(io.writeFile).not.toHaveBeenCalled();
  });

  it('redacts a secret found only by value pattern before writing', async () => {
    const remainingSecret = [
      'Bear',
      'er ',
      'eyJ',
      'hbGciOiJIUzI1NiJ9',
      '.',
      'eyJzdWIiOiIxIn0',
      '.',
      'runtime-signature',
    ].join('');
    const io = {
      readFile: vi.fn(async () =>
        JSON.stringify({ opaqueRuntimeValue: remainingSecret }),
      ),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    };

    await runSanitizeExportCommand(
      ['D:\\exports\\raw.json', 'D:\\exports\\safe.json'],
      io,
    );

    expect(io.mkdir).toHaveBeenCalledTimes(1);
    expect(io.writeFile).toHaveBeenCalledTimes(1);
    const content = io.writeFile.mock.calls[0]?.[1] as string;
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain(remainingSecret);
    expect(scanSecrets(JSON.parse(content))).toEqual([]);
  });

  it('accepts business data in contract-valid fixtures and reports secrets generically', async () => {
    const detected = bearerSecret();
    const validFixture = renderScenarioFixture({
      scenarioKey: 'match-cpf-sem-id-cliente',
      version: 1,
      seed: 'fixture-seed',
      runId: 'run_fixture',
      eventStartAt: '2026-08-22T15:00:00.000Z',
    });
    const result = await validateFixtureDirectory('D:\\repo\\fixtures', {
      exists: vi.fn(async () => true),
      listJsonFiles: vi.fn(async () => [
        'D:\\repo\\fixtures\\business-data.json',
        'D:\\repo\\fixtures\\invalid.json',
        'D:\\repo\\fixtures\\secret.json',
      ]),
      readFile: vi.fn(async (file: string) =>
        JSON.stringify(
          file.endsWith('business-data.json')
            ? validFixture
            : file.endsWith('secret.json')
              ? { ...validFixture, token: detected }
              : {
                  cpf: '52998224725',
                  email: sourceEmail(),
                  telefone: '+55 (11) 98765-4321',
                },
        ),
      ),
    });

    expect(result.checked).toBe(3);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'invalid.json',
          path: '$',
          category: 'INVALID_FIXTURE',
        }),
        expect.objectContaining({
          file: 'secret.json',
          path: '$.token',
          category: 'CREDENTIAL',
        }),
      ]),
    );
    expect(
      result.findings.some(({ file }) => file === 'business-data.json'),
    ).toBe(false);
    expect(JSON.stringify(result.findings)).not.toContain(detected);
  });

  function bearerSecret(): string {
    return ['Bear', 'er ', 'abc.def.ghi'].join('');
  }

  it('reports malformed fixture JSON generically', async () => {
    const malformed = ['{', 'conteudo-privado', ':'].join('');
    const result = await validateFixtureDirectory('D:\\repo\\fixtures', {
      exists: vi.fn(async () => true),
      listJsonFiles: vi.fn(async () => ['D:\\repo\\fixtures\\broken.json']),
      readFile: vi.fn(async () => malformed),
    });

    expect(result).toEqual({
      checked: 1,
      findings: [
        {
          file: 'broken.json',
          path: '$',
          category: 'INVALID_JSON',
          message: 'Fixture JSON invalida.',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(malformed);
  });

  it('succeeds clearly when the fixture directory does not exist', async () => {
    const result = await validateFixtureDirectory('D:\\repo\\fixtures', {
      exists: vi.fn(async () => false),
      listJsonFiles: vi.fn(),
      readFile: vi.fn(),
    });

    expect(result).toEqual({ checked: 0, findings: [] });
  });
});
