import type { EslintLanguageContract } from '#cli/types/checks/language/javascript.ts';

/** How many source paths one disabled-rule diagnostic lists before its remaining count. */
export const RULE_OFF_PATHS = 3;

/** JavaScript owns shared code rules; TypeScript adds its type safety requirements. */
export const REQUIRED_ESLINT_LANGUAGE_CONTRACTS: Record<string, EslintLanguageContract> = {
    javascript: { ending: 'js', languages: ['javascript', 'typescript'] },
    typescript: { ending: 'ts', languages: ['typescript'] },
};
