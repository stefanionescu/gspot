import type { Pipeline } from '#cli/types/generation/ci.ts';

export const SHAPE: Pipeline = {
    version: '1.2.3',
    platforms: ['linux'],
    swiftScope: undefined,
    isMise: true,
    manualChecks: ['security/codeql'],
};
