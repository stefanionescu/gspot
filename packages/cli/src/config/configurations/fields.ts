import { DEFAULT_PATTERN } from '#cli/config/configurations/output.ts';

export const DEFAULT_OUTPUT_FORMAT = { format: 'regex', pattern: DEFAULT_PATTERN } as const;

export const MAX_EXIT_CODE = 255;
