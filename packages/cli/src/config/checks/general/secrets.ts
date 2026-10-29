export const GITLEAKS_LOG_OPTIONS = '--diff-merges=separate';

export const ENV_KEY_LINE = /^(?:#\s*)?(?:export )?(?<key>[A-Z][A-Z0-9_]*)=/u;

export const GITLEAKS_LOG_FLAG = '--log-opts';

export const ENVIRONMENT_READ_LANGUAGES = ['javascript', 'typescript', 'python', 'vue', 'svelte', 'astro'] as const;

export const GITLEAKS_STAGED_CHECK = 'secrets/gitleaks-staged';

export const GITLEAKS_STAGED_FLAG = '--staged';

export const MISSING_KEY_RULE = 'missing-key';
