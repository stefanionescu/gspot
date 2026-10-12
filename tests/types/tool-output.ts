import type { Linter } from 'eslint';
import type { Finding } from '#cli/types/execution/check.ts';

/** A native ESLint diagnostic projected onto its repository-relative source location. */
export type LintFinding = { rule: Linter.LintMessage['ruleId']; file: string; line: Linter.LintMessage['line'] };
/** The native link failure expected in one independently configured project. */
export type LinkFailure = { scope: string; file: string; rule: string };

export type TypecheckOutcome = { code: number; output: string; findings: Finding[] };
export type ParameterFinding = {
    code?: string;
    rule_id?: string;
    line?: number;
    location?: { row: number };
};

/** The normalized native ESLint configuration read by generation tests. */
export type EslintConfiguration = {
    rules: Record<string, [Linter.Severity, ...unknown[]]>;
    languageOptions: { globals: Record<string, string | boolean>; sourceType: string };
    plugins: Record<string, unknown>;
    settings: { next?: { rootDir: string } | undefined } & Record<string, unknown>;
    linterOptions: { reportUnusedDisableDirectives: Linter.Severity };
};

/** The report fields compared by CLI tests. */
export type FindingRow = { file: string; line: number | undefined; rule: string | undefined };

/** Source text and native findings for one retained ESLint case. */
export type SourceRuleCase = { name?: string; source: string; rule: string; count: number };
