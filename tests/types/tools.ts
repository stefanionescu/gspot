import type { Linter } from 'eslint';
import type { Config } from 'stylelint';

export type LintFinding = { rule: Linter.LintMessage['ruleId']; file: string; line: Linter.LintMessage['line'] };

export type EslintConfiguration = {
    rules: Record<string, [Linter.Severity, ...unknown[]]>;
    languageOptions: { globals: Record<string, string | boolean>; sourceType: string };
    plugins: Record<string, unknown>;
    settings: { next?: { rootDir: string } | undefined } & Record<string, unknown>;
    linterOptions: { reportUnusedDisableDirectives: Linter.Severity };
};

export type SourceRuleCase = { name?: string; source: string; rule: string; count: number };

export type ScriptFindingCase = {
    file: string;
    recommended: readonly { ruleId: string | null; line: number }[];
    all?: readonly { ruleId: string | null; line: number }[];
};

export type LinterJsonFinding = {
    code?: string;
    rule_id?: string;
    line?: number;
    location?: { row: number };
};

export type RuffRule = { code: string | null; preview: boolean };

export type RuffConfigFile = {
    lint: {
        select: string[];
        pylint: {
            'max-statements': number;
            'max-args': number;
            'max-positional-args': number;
            'max-branches': number;
            'max-returns': number;
        };
        mccabe: { 'max-complexity': number };
        'per-file-ignores'?: Record<string, string[]>;
    };
    format: { 'quote-style': string };
};

export type KnipConfigFile = { ignore: string[]; workspaces: Record<string, { entry: string[] }> };

export type StylelintConfigFile = Required<Pick<Config, 'rules'>> & Pick<Config, 'overrides'>;

export type SemgrepRuleFile = { rules: { id: string; paths?: { include?: string[]; exclude?: string[] } }[] };

export type Tsconfig = {
    extends?: string | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    compilerOptions?: { typeRoots?: string[] | undefined } | undefined;
};
