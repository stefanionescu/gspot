export type SizeCase = { file: string; rule: string; line: number; source: string; corrected: string; message: string };

export type SourceRuleCase = { name?: string; source: string; rule: string; count: number };

export type ScriptFindingCase = {
    file: string;
    everyLevel: readonly { ruleId: string | null; line: number }[];
    all?: readonly { ruleId: string | null; line: number }[];
};

export type RuffConfig = {
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

export type KnipConfig = { ignore: string[]; workspaces: Record<string, { entry: string[] }> };

export type SemgrepRuleFile = { rules: { id: string; paths?: { include?: string[]; exclude?: string[] } }[] };
