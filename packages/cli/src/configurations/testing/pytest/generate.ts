import { NON_PYTHON_TEST_PATTERNS } from '#cli/config/configurations/testing.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

function buildCoverageFile(planned: PlannedConfig): string {
    const patterns = planned.scope.settings.test_files
        .filter((pattern) => !NON_PYTHON_TEST_PATTERNS.has(pattern))
        .map((pattern) => `    ${pattern}`);
    return ['[run]', 'omit =', ...patterns, ''].join('\n');
}

export const PYTEST_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'pytest/coveragerc': buildCoverageFile,
};
