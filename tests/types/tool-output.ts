import type { Linter } from 'eslint';
import type { Finding } from '#cli/types/runs/check.ts';

export type LintFinding = { rule: Linter.LintMessage['ruleId']; file: string; line: Linter.LintMessage['line'] };

export type LinkFailure = { scope: string; file: string; rule: string };

export type TypecheckResult = { code: number; output: string; findings: Finding[] };

export type ParameterFinding = {
    code?: string;
    rule_id?: string;
    line?: number;
    location?: { row: number };
};

export type EslintConfiguration = {
    rules: Record<string, [Linter.Severity, ...unknown[]]>;
    languageOptions: { globals: Record<string, string | boolean>; sourceType: string };
    plugins: Record<string, unknown>;
    settings: { next?: { rootDir: string } | undefined } & Record<string, unknown>;
    linterOptions: { reportUnusedDisableDirectives: Linter.Severity };
};

export type FindingRow = { file: string; line: number | undefined; rule: string | undefined };

export type ScopeFindingRow = FindingRow & { scope: string };

export type SourceRuleCase = { name?: string; source: string; rule: string; count: number };

export type ScriptFindingCase = {
    file: string;
    recommended: readonly { ruleId: string | null; line: number }[];
    all?: readonly { ruleId: string | null; line: number }[];
};

export type RuffRule = { code: string | null; preview: boolean };
export type RuffConfiguration = { lint: { select: string[] } };
