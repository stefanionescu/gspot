import type { z } from 'zod';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import type { reportSchema, thresholdsSchema } from '#cli/parsers/schema/jest.ts';

export type JestRun = { input: EngineInput; source: string; work: string };

export type TestReport = z.infer<typeof reportSchema>;

export type Suite = TestReport['testResults'][number];

/** The validated coverage settings selected by repository policy. */
export type JestSettings = z.infer<typeof thresholdsSchema>;
