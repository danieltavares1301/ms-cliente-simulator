import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  anonymizeJson,
  assertNoSensitiveData,
} from '../src/redaction/index.ts';
import { requireExplicitLocalPath } from './local-path.ts';

export interface AnonymizeIo {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<unknown>;
  mkdir(path: string): Promise<unknown>;
}

const defaultIo: AnonymizeIo = {
  readFile: (filePath) => readFile(filePath, 'utf8'),
  writeFile: (filePath, content) =>
    writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' }),
  mkdir: (directory) => mkdir(directory, { recursive: true }),
};

function parseArguments(args: readonly string[]): {
  inputPath: string;
  outputPath: string;
  seed: string;
} {
  const inputPath = requireExplicitLocalPath(
    args[0],
    'Entrada: informe um caminho local explicito.',
  );
  const outputPath = requireExplicitLocalPath(
    args[1],
    'Saida: informe um caminho local explicito.',
  );
  let seed = 'offline-redaction-v1';

  for (let index = 2; index < args.length; index += 1) {
    if (
      args[index] !== '--seed' ||
      !args[index + 1] ||
      index + 2 !== args.length
    ) {
      throw new Error(
        'Uso: anonymize:logs <entrada.json> <saida.json> [--seed <seed>].',
      );
    }
    seed = args[index + 1];
    index += 1;
  }
  return { inputPath, outputPath, seed };
}

function canonical(filePath: string): string {
  return path.resolve(filePath).toLowerCase();
}

function pointsInsideRawFixtures(filePath: string): boolean {
  return canonical(filePath)
    .split(path.sep)
    .join('/')
    .includes('/fixtures/raw/');
}

export async function runAnonymizeCommand(
  args: readonly string[],
  io: AnonymizeIo = defaultIo,
): Promise<{ inputPath: string; outputPath: string }> {
  const { inputPath, outputPath, seed } = parseArguments(args);
  if (canonical(inputPath) === canonical(outputPath)) {
    throw new Error('A saida nao pode sobrescrever o arquivo de entrada.');
  }
  if (pointsInsideRawFixtures(outputPath)) {
    throw new Error('A saida nao pode ficar dentro de fixtures/raw.');
  }

  const raw = await io.readFile(inputPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSON invalido; o conteudo nao foi exibido.');
  }

  const transformed = anonymizeJson(parsed, { seed });
  assertNoSensitiveData(transformed);
  await io.mkdir(path.dirname(outputPath));
  await io.writeFile(outputPath, `${JSON.stringify(transformed, null, 2)}\n`);
  return { inputPath, outputPath };
}

async function main(): Promise<void> {
  try {
    await runAnonymizeCommand(process.argv.slice(2));
    console.log('Arquivo anonimizado e validado localmente.');
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Falha offline durante a anonimizacao.';
    console.error(message);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  void main();
}
