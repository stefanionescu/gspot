import type { ScriptSyntax } from '#cli/types/parsers/bash.ts';

/** How an analysis reports one finding in one file. */
export type ScriptReport = (line: number, rule: string, text: string) => void;

/** One parsed shell source owned by a built-in check. */
export type ScriptFile = ScriptSyntax & {
    path: string;
    text: string;
    lines: string[];
    isExecutable: boolean;
    references: Map<string, number[]>;
};
