import type { Pipeline } from '#cli/types/generation/ci.ts';

export const PIPELINE: Pipeline = {
    version: '1.2.3',
    platforms: ['linux'],
    hasSwift: false,
    isMise: true,
    manualChecks: ['security/codeql'],
};
