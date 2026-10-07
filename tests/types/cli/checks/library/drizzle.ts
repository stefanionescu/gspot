import type { TestdirResult } from 'testdirs';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';

/** The fixture contract owned by this behavior's tests. */
export type MigrationProject = {
    directory: TestdirResult;
    path: (file: string) => string;
    manual: string;
    mode: number;
    initial: string;
    check: CheckDeclaration;
    input: CheckInput;
};
