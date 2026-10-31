import type { PlannedConfig } from '#cli/types/generation/files.ts';

/**
Build the coverage exclusions for the test files of this scope.

@param planned the coverage file and its owning scope.
@returns the coverage.py run settings.
*/
export function buildCoverageFile(planned: PlannedConfig): string {
    const patterns = planned.scope.settings.test_files.map((pattern) => `    ${pattern}`);
    return ['[run]', 'omit =', ...patterns, ''].join('\n');
}
