import { HASH_SOURCE } from '#cli/config/parsers/git.ts';

export const CHANGE_LINE = new RegExp(`^:[0-7]{6} (100644|100755|120000) ${HASH_SOURCE} (${HASH_SOURCE}) [AMT]$`, 'u');

export const DIFF_TREE = [
    'diff-tree',
    '--root',
    '--no-commit-id',
    '--raw',
    '-z',
    '--no-renames',
    '-r',
    '-m',
    '--diff-filter=AMT',
] as const;

export const COMMIT_METADATA = [
    'show',
    '--no-patch',
    '--no-show-signature',
    '--format=%an%n%ae%n%cn%n%ce%n%B',
] as const;

/** Scan each selected commit, including both sides of a merge, without walking its ancestors. */
export const GITLEAKS_LOG_OPTIONS = '--no-walk --diff-merges=separate';

/** Each raw Git change contains metadata followed by its path. */
export const RAW_CHANGE_FIELDS = 2;

/** Environment reads expose the key through the same named capture in each supported form. */
export const ENV_READ_PATTERNS = [
    /\bBun\.env\.(?<key>[A-Z][A-Z0-9_]*)/gu,
    /\bBun\.env\[['"](?<key>[A-Z][A-Z0-9_]*)['"]\]/gu,
    /import\.meta\.env\.(?<key>[A-Z][A-Z0-9_]*)/gu,
    /import\.meta\.env\[['"](?<key>[A-Z][A-Z0-9_]*)['"]\]/gu,
    /Deno\.env\.get\(\s*['"](?<key>[A-Z][A-Z0-9_]*)['"]/gu,
    /process\.env\.(?<key>[A-Z][A-Z0-9_]*)/gu,
    /process\.env\[['"](?<key>[A-Z][A-Z0-9_]*)['"]\]/gu,
    /os\.environ\[['"](?<key>[A-Z][A-Z0-9_]*)['"]\]/gu,
    /os\.environ\.get\(\s*['"](?<key>[A-Z][A-Z0-9_]*)['"]/gu,
    /os\.getenv\(\s*['"](?<key>[A-Z][A-Z0-9_]*)['"]/gu,
] as const;

/** A key line in an environment file, trimmed: the key before the equals sign. */
export const ENV_KEY_LINE = /^(?:export )?(?<key>[A-Z][A-Z0-9_]*)=/u;

export const ENUMERATOR_FILE = 'commits.jsonl';
export const TRUFFLEHOG_ENUMERATOR = ['trufflehog', 'json-enumerator'] as const;
export const TRUFFLEHOG_FLAGS = [
    '--results=verified',
    '--json',
    '--fail',
    '--fail-on-scan-errors',
    '--no-update',
] as const;
export const GITLEAKS_LOG_FLAG = '--log-opts';
export const ENV_READ_LANGUAGES = ['javascript', 'typescript', 'python', 'vue', 'svelte', 'astro'] as const;

export const GITLEAKS_STAGED_CHECK = 'secrets/gitleaks-staged';
export const GITLEAKS_STAGED_FLAG = '--staged';
