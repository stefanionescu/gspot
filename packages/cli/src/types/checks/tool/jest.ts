import type { z } from 'zod';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { reportSchema } from '#cli/parsers/schema/jest.ts';
import type { settingNamespaceSchemas } from '#cli/policy/schema/namespaces.ts';

export type JestRun = { input: CheckInput; source: string; work: string };

export type TestReport = z.infer<typeof reportSchema>;

export type Suite = TestReport['testResults'][number];

/** The validated coverage settings selected by repository policy. */
export type JestSettings = z.output<ReturnType<typeof settingNamespaceSchemas.coverage.required>>;
