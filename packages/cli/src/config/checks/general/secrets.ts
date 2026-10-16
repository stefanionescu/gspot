/** Scan each selected commit, including both sides of a merge, without walking its ancestors. */
export const GITLEAKS_LOG_OPTIONS = '--no-walk --diff-merges=separate';

/** A key line in an environment file, trimmed: the key before the equals sign. */
export const ENV_KEY_LINE = /^(?:export )?(?<key>[A-Z][A-Z0-9_]*)=/u;
// TruffleHog reads file:///D:/repo as the path /D:/repo, which Windows refuses. file://. names the working folder.
export const TRUFFLEHOG_GIT_COMMAND = ['trufflehog', 'git', 'file://.'] as const;
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
