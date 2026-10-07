import type { Mock } from 'bun:test';
import type { TestdirResult } from 'testdirs';
import type { inspectTool } from '#cli/tools/inspect.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';

/** The fixture contract owned by this behavior's tests. */
export type WorkerTypesProject = {
    directory: TestdirResult;
    path: (name: string) => string;
    target: string;
    edited: string;
    mode: number;
    check: CheckDeclaration;
    input: CheckInput;
    locate: Mock<typeof inspectTool>;
};
