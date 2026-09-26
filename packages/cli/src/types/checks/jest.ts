// The types of checks/jest in this package.
import type { z } from 'zod';
import type { reportSchema } from '#cli/checks/jest/run.ts';
import type { EngineInput } from '#cli/types/checks/checks.ts';

export type JestRun = { input: EngineInput; source: string; work: string };
export type TestReport = z.infer<typeof reportSchema>;
export type Suite = TestReport['testResults'][number];
