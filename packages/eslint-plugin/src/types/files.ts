import type { TSESLint } from '@typescript-eslint/utils';

/** The linted file and the root used by path-aware rules. */
export type LintedPath = { absolute: string; relative: string; root: string };

export type RuleContext = Readonly<TSESLint.RuleContext<string, unknown[]>>;
