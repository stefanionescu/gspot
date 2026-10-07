import type { TestdirResult } from 'testdirs';
import type { CheckSpec } from '#cli/types/configurations.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';

/** The fixture contract owned by this behavior's tests. */
export type OpenapiProject = {
    directory: TestdirResult;
    document: string;
    edited: string;
    mode: number;
    spec: CheckSpec;
    input: EngineInput;
};
