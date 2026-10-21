export const CHECK_STATUSES = ['passed', 'failed', 'missing', 'skipped', 'error'] as const;

export const FAILED_STATUSES = new Set<(typeof CHECK_STATUSES)[number]>(['failed', 'error']);

export const RAN_STATUSES = new Set<(typeof CHECK_STATUSES)[number]>(['passed', 'failed']);

export const INCOMPLETE_STATUSES = new Set<(typeof CHECK_STATUSES)[number]>(['missing', 'error']);

export const DOCKER_MISSING_MESSAGE = 'Docker is not installed. Install Docker to run this check.';
