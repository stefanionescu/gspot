// The types of checks/tool/jest in this package.
import type { z } from 'zod';
import type { reportSchema } from '#cli/checks/tool/jest.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';

export type JestRun = { input: EngineInput; source: string; work: string };
export type TestReport = z.infer<typeof reportSchema>;
export type Suite = TestReport['testResults'][number];
