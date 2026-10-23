export const GITLEAKS_LOG_OPTIONS = '--no-walk --diff-merges=separate';

export const ENV_KEY_LINE = /^(?:export )?(?<key>[A-Z][A-Z0-9_]*)=/u;

export const GITLEAKS_LOG_FLAG = '--log-opts';

export const ENV_READ_LANGUAGES = ['javascript', 'typescript', 'python', 'vue', 'svelte', 'astro'] as const;

export const GITLEAKS_STAGED_CHECK = 'secrets/gitleaks-staged';

export const GITLEAKS_STAGED_FLAG = '--staged';
