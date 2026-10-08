import type { TestdirResult } from 'testdirs';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';

export type OpenapiProject = {
    directory: TestdirResult;
    document: string;
    edited: string;
    mode: number;
    check: CheckDeclaration;
    input: CheckInput;
};
