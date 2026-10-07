import type { TestdirResult } from 'testdirs';
import type { CheckSpec } from '#cli/types/configurations.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';

/** The fixture contract owned by this behavior's tests. */
export type MigrationProject = {
    directory: TestdirResult;
    path: (file: string) => string;
    manual: string;
    mode: number;
    initial: string;
    spec: CheckSpec;
    input: EngineInput;
};
