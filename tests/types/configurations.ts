import type { Level } from '#cli/types/settings.ts';

export type SizeCase = { rule: string; line: number; limit: number; source: string; corrected: string };

export type SelectorSample = {
    name: string;
    configurations: readonly string[];
    level: Level;
    tables?: string;
    files: Readonly<Record<string, string>>;
    findings: Readonly<Record<string, readonly number[]>>;
    corrected?: Readonly<Record<string, string>>;
    message?: string;
};

export type ScriptFindingCase = {
    file: string;
    everyLevel: ReadonlyArray<{ ruleId: string | null; line: number }>;
    all?: ReadonlyArray<{ ruleId: string | null; line: number }>;
};

export type RuffConfig = {
    lint: { 'per-file-ignores'?: Record<string, string[]> };
    format: { 'quote-style': string };
};

export type KnipConfig = {
    ignore: string[];
    ignoreBinaries: string[];
    workspaces: Record<string, { entry: string[] }>;
};
