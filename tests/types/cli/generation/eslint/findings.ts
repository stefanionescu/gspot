import type { Linter } from 'eslint';

/** A native ESLint diagnostic projected onto its repository-relative source location. */
export type FileRuleFinding = { rule: Linter.LintMessage['ruleId']; file: string; line: Linter.LintMessage['line'] };
