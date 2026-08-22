import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  scanSensitiveData,
  type SensitiveCategory,
} from '../src/redaction/index.ts';

export interface FixtureValidationFinding {
  file: string;
  path: string;
  category: SensitiveCategory | 'INVALID_JSON';
  message: string;
}

export interface FixtureValidationIo {
  exists(path: string): Promise<boolean>;
  listJsonFiles(path: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
}

async function listJsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.toLowerCase() === 'raw') continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listJsonFiles(entryPath)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      files.push(entryPath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

const defaultIo: FixtureValidationIo = {
  exists: async (target) => {
    try {
      await access(target);
      return true;
    } catch {
      return false;
    }
  },
  listJsonFiles,
  readFile: (filePath) => readFile(filePath, 'utf8'),
};

function requireLocalPath(value: string | undefined): string {
  if (!value || value === '-' || /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value)) {
    throw new Error('Informe um caminho local explicito para as fixtures.');
  }
  return value;
}

export async function validateFixtureDirectory(
  directory: string,
  io: FixtureValidationIo = defaultIo,
): Promise<{ checked: number; findings: FixtureValidationFinding[] }> {
  const explicitDirectory = requireLocalPath(directory);
  if (!(await io.exists(explicitDirectory)))
    return { checked: 0, findings: [] };

  const files = await io.listJsonFiles(explicitDirectory);
  const findings: FixtureValidationFinding[] = [];
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await io.readFile(file));
    } catch {
      findings.push({
        file: path.relative(explicitDirectory, file),
        path: '$',
        category: 'INVALID_JSON',
        message: 'Fixture JSON invalida.',
      });
      continue;
    }
    for (const finding of scanSensitiveData(parsed)) {
      findings.push({
        file: path.relative(explicitDirectory, file),
        ...finding,
      });
    }
  }
  return { checked: files.length, findings };
}

async function main(): Promise<void> {
  try {
    const directory = requireLocalPath(process.argv[2]);
    if (process.argv.length !== 3)
      throw new Error('Uso: validate:fixtures <diretorio-local>.');
    const result = await validateFixtureDirectory(directory);
    if (result.findings.length > 0) {
      for (const finding of result.findings) {
        console.error(
          `${finding.file}: ${finding.category} em ${finding.path}`,
        );
      }
      process.exitCode = 1;
      return;
    }
    if (result.checked === 0)
      console.log('Nenhuma fixture JSON encontrada; validacao concluida.');
    else
      console.log(
        `${result.checked} fixture(s) JSON validada(s) sem dados sensiveis.`,
      );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : 'Falha offline ao validar fixtures.',
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  void main();
}
