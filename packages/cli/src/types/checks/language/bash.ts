import type { ScriptSyntax } from '#cli/types/parsers/code/bash.ts';

export type LayoutIssue = { line: number; rule: string; text: string };

export type ScriptFile = ScriptSyntax & {
    path: string;
    lines: string[];
    isExecutable: boolean;
};
