/** Environment reads expose the key through the same named capture in each supported form. */
export const ENV_READ_PATTERNS = [
    /import\.meta\.env\.(?<key>[A-Z][A-Z0-9_]*)/gu,
    /import\.meta\.env\[['"](?<key>[A-Z][A-Z0-9_]*)['"]\]/gu,
    /Deno\.env\.get\(\s*['"](?<key>[A-Z][A-Z0-9_]*)['"]/gu,
    /process\.env\.(?<key>[A-Z][A-Z0-9_]*)/gu,
    /process\.env\[['"](?<key>[A-Z][A-Z0-9_]*)['"]\]/gu,
    /os\.environ\[['"](?<key>[A-Z][A-Z0-9_]*)['"]\]/gu,
    /os\.environ\.get\(\s*['"](?<key>[A-Z][A-Z0-9_]*)['"]/gu,
    /os\.getenv\(\s*['"](?<key>[A-Z][A-Z0-9_]*)['"]/gu,
];

/** A key line in an environment file, trimmed: the key before the equals sign. */
export const ENV_KEY_LINE = /^(?:export )?(?<key>[A-Z][A-Z0-9_]*)=/u;
