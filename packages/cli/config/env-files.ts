// Environment-file patterns and template names. Literals only.

export const ENV_FILE_PATTERNS = ['.env', '.env.*', '.dev.vars', '.dev.vars.*'];

export const ENV_TEMPLATE_NAMES = ['.env.example', '.env.template', '.env.sample', '.dev.vars.example'];

/** How code reads an environment variable, by language; the first group is the key. */
export const ENV_READ_PATTERNS = [
    /process\.env\.([A-Z][A-Z0-9_]*)/gu,
    /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/gu,
    /os\.environ\[['"]([A-Z][A-Z0-9_]*)['"]\]/gu,
    /os\.environ\.get\(\s*['"]([A-Z][A-Z0-9_]*)['"]/gu,
    /os\.getenv\(\s*['"]([A-Z][A-Z0-9_]*)['"]/gu,
];

/** The files the environment reads are searched in. */
export const ENV_READ_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx', '.py'];

/** A key line in an environment file, trimmed: the key before the equals sign. */
export const ENV_KEY_LINE = /^(?:export )?([A-Z][A-Z0-9_]*)=/u;
