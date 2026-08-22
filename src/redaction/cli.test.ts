import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { runAnonymizeCommand } from '../../scripts/anonymize-log-export';
import { validateFixtureDirectory } from '../../scripts/validate-fixtures';
import { scanSensitiveData } from './scanner';

const sourceEmail = () =>
  ['entrada', 'corp', 'invalid'].join('@').replace('@corp@', '@corp.');

describe('offline redaction commands', () => {
  it('reads and writes only through local-file dependencies and validates transformed output', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const io = {
      readFile: vi.fn(async () =>
        JSON.stringify({ nome: 'origem', email: sourceEmail() }),
      ),
      writeFile: vi.fn(async (path: string, content: string) =>
        writes.push({ path, content }),
      ),
      mkdir: vi.fn(async () => undefined),
    };

    const result = await runAnonymizeCommand(
      [
        'D:\\exports\\raw.json',
        'D:\\exports\\safe.json',
        '--seed',
        'seed-local',
      ],
      io,
    );

    expect(result).toEqual({
      inputPath: 'D:\\exports\\raw.json',
      outputPath: 'D:\\exports\\safe.json',
    });
    expect(io.readFile).toHaveBeenCalledTimes(1);
    expect(io.writeFile).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(1);
    expect(scanSensitiveData(JSON.parse(writes[0].content))).toEqual([]);
    expect(writes[0].content).not.toContain(sourceEmail());
  });

  it('rejects URL input before any I/O, proving the command does not attempt network access', async () => {
    const io = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    };

    await expect(
      runAnonymizeCommand(
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
        runAnonymizeCommand([inputPath, String.raw`D:\exports\safe.json`], io),
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
      new URL('../../scripts/anonymize-log-export.ts', import.meta.url),
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
      runAnonymizeCommand(['D:\\x.json', 'D:\\x.json'], io),
    ).rejects.toThrow('sobrescrever o arquivo de entrada');
    await expect(
      runAnonymizeCommand(
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
      await runAnonymizeCommand(
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

  it('reports fixture findings without exposing detected values', async () => {
    const detected = sourceEmail();
    const safe = ['cliente', 'example', 'test']
      .join('@')
      .replace('@example@', '@example.');
    const result = await validateFixtureDirectory('D:\\repo\\fixtures', {
      exists: vi.fn(async () => true),
      listJsonFiles: vi.fn(async () => [
        'D:\\repo\\fixtures\\safe.json',
        'D:\\repo\\fixtures\\unsafe.json',
      ]),
      readFile: vi.fn(async (file: string) =>
        JSON.stringify({
          email: file.endsWith('unsafe.json') ? detected : safe,
        }),
      ),
    });

    expect(result.checked).toBe(2);
    expect(result.findings).toEqual([
      expect.objectContaining({
        file: 'unsafe.json',
        path: '$.email',
        category: 'EMAIL',
      }),
    ]);
    expect(JSON.stringify(result.findings)).not.toContain(detected);
  });

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
