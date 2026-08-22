import path from 'node:path';

const URI_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;
const WINDOWS_REMOTE_OR_DEVICE_PATTERN = /^(?:\\\\|\/\/)/;

export function requireExplicitLocalPath(
  value: string | undefined,
  message: string,
): string {
  if (
    !value ||
    value === '-' ||
    URI_PATTERN.test(value) ||
    WINDOWS_REMOTE_OR_DEVICE_PATTERN.test(value)
  ) {
    throw new Error(message);
  }
  return value;
}

function pathImplementation(
  ...values: readonly string[]
): typeof path.win32 | typeof path {
  return values.some(
    (value) => path.win32.isAbsolute(value) || value.includes('\\'),
  )
    ? path.win32
    : path;
}

export function resolvesInsidePath(root: string, candidate: string): boolean {
  const implementation = pathImplementation(root, candidate);
  const relative = implementation.relative(
    implementation.resolve(root),
    implementation.resolve(candidate),
  );
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${implementation.sep}`) &&
      !implementation.isAbsolute(relative))
  );
}
