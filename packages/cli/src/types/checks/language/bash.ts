import type { ScriptSyntax } from '#cli/types/parsers/code/bash.ts';

/** One script-layout issue before attaching its file and check. */
export type LayoutIssue = { line: number; rule: string; text: string };

/** One parsed shell script: its path, text, lines, executable bit, and the lines that call each command. */
export type ScriptFile = ScriptSyntax & {
    path: string;
    lines: string[];
    isExecutable: boolean;
};
