import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  scanRenderedFixtureSensitiveData,
  scanSensitiveData,
  type SensitiveCategory,
} from '../src/redaction/index.ts';
import { scenarioCatalog } from '../src/scenarios/catalog.ts';
import { renderScenarioFixture } from '../src/scenarios/renderer.ts';
import { renderedScenarioFixtureSchema } from '../src/contracts/fixtures.ts';

export interface FixtureValidationFinding {
  file: string;
  path: string;
  category: SensitiveCategory | 'INVALID_JSON' | 'INVALID_FIXTURE';
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
    const renderedFixture = renderedScenarioFixtureSchema.safeParse(parsed);
    const fixtureFindings = renderedFixture.success
      ? scanRenderedFixtureSensitiveData(renderedFixture.data)
      : scanSensitiveData(parsed);
    for (const finding of fixtureFindings) {
      findings.push({
        file: path.relative(explicitDirectory, file),
        ...finding,
      });
    }
  }
  return { checked: files.length, findings };
}

const validationInput = {
  seed: 'phase-two-validation',
  runId: 'run_fixture_validation',
  eventStartAt: '2026-08-22T15:00:00.000Z',
} as const;

export function validateRenderedFixtures(): {
  checked: number;
  findings: FixtureValidationFinding[];
} {
  const findings: FixtureValidationFinding[] = [];
  const scenarios = scenarioCatalog.listActive();

  for (const scenario of scenarios) {
    const file = `${scenario.key}@${scenario.version}`;
    try {
      const input = {
        ...validationInput,
        scenarioKey: scenario.key,
        version: scenario.version,
      };
      const first = renderScenarioFixture(input);
      const second = renderScenarioFixture(input);
      const alternateRun = renderScenarioFixture({
        ...input,
        runId: 'run_fixture_validation_other',
      });

      renderedScenarioFixtureSchema.parse(first);
      if (JSON.stringify(first) !== JSON.stringify(second)) {
        findings.push({
          file,
          path: '$',
          category: 'INVALID_FIXTURE',
          message: 'Fixture nao deterministica.',
        });
      }
      if (
        first.identifiers.accountIdCliente ===
          alternateRun.identifiers.accountIdCliente ||
        first.identifiers.accountIdProspect ===
          alternateRun.identifiers.accountIdProspect
      ) {
        findings.push({
          file,
          path: '$.identifiers',
          category: 'INVALID_FIXTURE',
          message: 'Namespace de fixture invalido.',
        });
      }
      if (
        /\{\{|\$\{|VARIABLE|GENERATED|CONTRACT_ONLY/.test(JSON.stringify(first))
      ) {
        findings.push({
          file,
          path: '$',
          category: 'INVALID_FIXTURE',
          message: 'Fixture contem placeholder nao resolvido.',
        });
      }
      for (const finding of scanRenderedFixtureSensitiveData(first)) {
        findings.push({ file, ...finding });
      }
    } catch {
      findings.push({
        file,
        path: '$',
        category: 'INVALID_FIXTURE',
        message: 'Fixture renderizada invalida.',
      });
    }
  }

  return { checked: scenarios.length, findings };
}

async function main(): Promise<void> {
  try {
    if (process.argv.length > 3)
      throw new Error('Uso: validate:fixtures [diretorio-local].');
    const renderedResult = validateRenderedFixtures();
    const directory = process.argv[2]
      ? requireLocalPath(process.argv[2])
      : undefined;
    const directoryResult = directory
      ? await validateFixtureDirectory(directory)
      : { checked: 0, findings: [] };
    const findings = [...renderedResult.findings, ...directoryResult.findings];
    if (findings.length > 0) {
      for (const finding of findings) {
        console.error(
          `${finding.file}: ${finding.category} em ${finding.path}`,
        );
      }
      process.exitCode = 1;
      return;
    }
    console.log(
      `${renderedResult.checked} fixture(s) renderizada(s) validada(s); ` +
        `${directoryResult.checked} fixture(s) JSON adicional(is) validada(s).`,
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
