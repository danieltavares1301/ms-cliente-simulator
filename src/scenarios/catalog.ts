import {
  scenarioDefinitionSchema,
  type ScenarioDefinition,
  type ScenarioMetadata,
} from '../contracts';
import { basicScenarioDefinitions } from './definitions';

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ReadonlyScenarioDefinition = DeepReadonly<ScenarioDefinition>;

export type ScenarioCatalog = Readonly<{
  listAll: () => readonly ReadonlyScenarioDefinition[];
  listActive: () => readonly ReadonlyScenarioDefinition[];
  get: (key: string, version: number) => ReadonlyScenarioDefinition | undefined;
  getActive: (key: string) => ReadonlyScenarioDefinition | undefined;
}>;

function compareDefinitions(
  left: ReadonlyScenarioDefinition,
  right: ReadonlyScenarioDefinition,
): number {
  if (left.key !== right.key) return left.key < right.key ? -1 : 1;
  return left.version - right.version;
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) {
      deepFreeze(item);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export function createScenarioCatalog(
  definitions: readonly unknown[],
): ScenarioCatalog {
  const identities = new Set<string>();
  const parsedDefinitions = definitions.map((candidate) => {
    const parsed = scenarioDefinitionSchema.parse(candidate);
    const identity = `${parsed.key}@${parsed.version}`;
    if (identities.has(identity)) {
      throw new Error(`Duplicate scenario identity: ${identity}`);
    }
    identities.add(identity);
    return deepFreeze(parsed);
  });

  const all = deepFreeze([...parsedDefinitions].sort(compareDefinitions));
  const byIdentity = new Map(
    all.map((definition) => [
      `${definition.key}@${definition.version}`,
      definition,
    ]),
  );
  const active = new Map<string, ReadonlyScenarioDefinition>();
  for (const definition of all) {
    active.set(definition.key, definition);
  }
  const activeList = deepFreeze([...active.values()].sort(compareDefinitions));

  return Object.freeze({
    listAll: () => all,
    listActive: () => activeList,
    get: (key: string, version: number) => byIdentity.get(`${key}@${version}`),
    getActive: (key: string) => active.get(key),
  });
}

export function toScenarioMetadata(
  scenario: ReadonlyScenarioDefinition,
): ScenarioMetadata {
  return {
    key: scenario.key,
    version: scenario.version,
    name: scenario.name,
    description: scenario.description,
    scope: scenario.scope,
    tags: [...scenario.tags],
    availability: scenario.availability,
  };
}

export const scenarioCatalog = createScenarioCatalog(basicScenarioDefinitions);
