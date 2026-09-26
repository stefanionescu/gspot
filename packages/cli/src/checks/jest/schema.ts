import { z } from 'zod';
import { FULL_PERCENTAGE } from '#cli/constants/checks/jest.ts';

export const jestPercentage = z.number().min(0).max(FULL_PERCENTAGE);

/** Coverage floors shared by policy validation and native Jest execution. */
export const jestCoverageSettings = z.object({
    coverage_lines: jestPercentage,
    coverage_branches: jestPercentage,
    coverage_functions: jestPercentage,
    coverage_statements: jestPercentage,
});
