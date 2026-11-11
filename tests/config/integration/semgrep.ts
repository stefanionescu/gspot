import { BASE_INSTALLED_FILES } from '#tests/config/integration/commands.ts';

export const SEMGREP_CHECK_ID = 'security/semgrep';

export const SEMGREP_CHECK = ['check', '--only', SEMGREP_CHECK_ID, '--json'] as const;

export const SEMGREP_SANDBOX = {
    configurations: ['typescript', 'python', 'bash', 'security', 'fastapi'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
