import type { CheckInput } from '#cli/types/execution/check.ts';

export type WorkerTypesProject = {
    path: (name: string) => string;
    target: string;
    edited: string;
    mode: number;
    input: CheckInput;
};
