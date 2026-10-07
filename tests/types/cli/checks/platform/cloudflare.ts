import type { Mock } from 'bun:test';
import type { TestdirResult } from 'testdirs';
import type { inspectTool } from '#cli/tools/inspect.ts';
import type { CheckSpec } from '#cli/types/configurations.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';

/** The fixture contract owned by this behavior's tests. */
export type WorkerTypesProject = {
    directory: TestdirResult;
    path: (name: string) => string;
    target: string;
    edited: string;
    mode: number;
    spec: CheckSpec;
    input: EngineInput;
    locate: Mock<typeof inspectTool>;
};
