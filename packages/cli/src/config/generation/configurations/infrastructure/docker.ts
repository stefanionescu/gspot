import { NODE_MODULES } from '#cli/config/files/names.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { GIT_FOLDER } from '#cli/config/repository/files/tracked.ts';

export const HADOLINT_FAILURE_THRESHOLD = 'style';

export const HADOLINT_RECOMMENDED_OFF = [
    'DL3001',
    'DL3003',
    'DL3008',
    'DL3010',
    'DL3018',
    'DL3020',
    'DL3048',
    'DL4001',
] as const;

export const TRIVY_SKIPPED_FOLDERS = [NODE_MODULES, GSPOT_FOLDER, GIT_FOLDER] as const;
