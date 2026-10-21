import type { Linter } from 'eslint';
import type { Finding } from '#cli/types/runs/check.ts';

/** An ESLint finding with its path from the repository root. */
export type LintFinding = { rule: Linter.LintMessage['ruleId']; file: string; line: Linter.LintMessage['line'] };
/** A link failure that one scope must report. */
export type LinkFailure = { scope: string; file: string; rule: string };

export type TypecheckResult = { code: number; output: string; findings: Finding[] };
export type ParameterFinding = {
    code?: string;
    rule_id?: string;
    line?: number;
    location?: { row: number };
};

/** The parts of a calculated ESLint configuration that generation tests read. */
export type EslintConfiguration = {
    rules: Record<string, [Linter.Severity, ...unknown[]]>;
    languageOptions: { globals: Record<string, string | boolean>; sourceType: string };
    plugins: Record<string, unknown>;
    settings: { next?: { rootDir: string } | undefined } & Record<string, unknown>;
    linterOptions: { reportUnusedDisableDirectives: Linter.Severity };
};

/** The report fields compared by CLI tests. */
export type FindingRow = { file: string; line: number | undefined; rule: string | undefined };

/** Source text and the findings of one rule for an ESLint case. */
export type SourceRuleCase = { name?: string; source: string; rule: string; count: number };

/** The findings a source sample must give at each level. */
export type ScriptFindingCase = {
    file: string;
    recommended: readonly { ruleId: string | null; line: number }[];
    all?: readonly { ruleId: string | null; line: number }[];
};

export type RuffRule = { code: string | null; preview: boolean };
export type RuffConfiguration = { lint: { select: string[] } };
