import type { ScriptSyntax } from '#cli/types/parsers/bash.ts';

/** One script-layout issue before attaching its file and check. */
export type LayoutIssue = { line: number; rule: string; text: string };

/** One parsed shell source owned by a built-in check. */
export type ScriptFile = ScriptSyntax & {
    path: string;
    lines: string[];
    isExecutable: boolean;
};
