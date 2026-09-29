// The typescript analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { requiredRules } from '#cli/checks/typescript/required-rules.ts';
import { tsconfigOptions } from '#cli/checks/typescript/tsconfig-options.ts';

export const TYPESCRIPT_ANALYSES: Record<string, Engine> = {
    'tsconfig-options': tsconfigOptions,
    'required-rules': requiredRules,
};
