import type { CheckDeclaration } from '#cli/types/configurations.ts';

export type CheckContradiction = {
    applies: (check: CheckDeclaration) => boolean;
    error: (check: CheckDeclaration) => string;
};
