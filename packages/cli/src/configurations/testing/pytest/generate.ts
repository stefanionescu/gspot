import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { NON_PYTHON_TEST_PATTERNS } from '#cli/config/configurations/framework.ts';

/**
Build the coverage exclusions for the test files of this scope.

@param planned the coverage file and its owning scope.
@returns the coverage.py run settings.
*/
function buildCoverageFile(planned: PlannedConfig): string {
    const patterns = planned.scope.settings.test_files
        .filter((pattern) => !NON_PYTHON_TEST_PATTERNS.has(pattern))
        .map((pattern) => `    ${pattern}`);
    return ['[run]', 'omit =', ...patterns, ''].join('\n');
}

export const PYTEST_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'pytest/coveragerc': buildCoverageFile,
};
