import path from "node:path";

export function resolveCliFilePath(rawValue: string, cwd = process.cwd()) {
  const normalizedInput = normalizeCliFilePathInput(rawValue);
  const win32 = path.win32;

  const msysMatch = normalizedInput.match(/^\/([a-zA-Z])\/(.*)$/);

  if (msysMatch) {
    const [, driveLetter, remainder] = msysMatch;
    return win32.normalize(`${driveLetter.toUpperCase()}:\\${remainder.replace(/\//g, "\\")}`);
  }

  if (win32.isAbsolute(normalizedInput)) {
    return win32.normalize(normalizedInput);
  }

  return win32.resolve(cwd, normalizedInput);
}

export function normalizeCliFilePathInput(rawValue: string) {
  const trimmed = rawValue.trim();
  const withoutWrappingQuotes = stripWrappingQuotes(trimmed);

  return withoutWrappingQuotes
    .replace(/\^\^/g, "^")
    .replace(/\^(.)/g, "$1")
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")
    .replace(/^\^+|\^+$/g, "");
}

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
