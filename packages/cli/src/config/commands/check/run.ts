import type { CheckStatus } from '#cli/types/runs/check.ts';

export const DOCKER_MISSING_MESSAGE = 'Docker is not installed. Install Docker to run this check.';

export const CANCELED_CHECK_NOTE = 'The check was canceled.';

export const FAILED_STATUSES = new Set<CheckStatus>(['failed', 'error']);

export const CHECK_COMMAND = 'gspot check';

export const HOOK_FLAG = '--hook';
