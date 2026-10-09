import type { CheckInput } from '#cli/types/execution/check.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';

export type MigrationProject = {
    path: (file: string) => string;
    manual: string;
    mode: number;
    initial: string;
    check: CheckDeclaration;
    input: CheckInput;
};
