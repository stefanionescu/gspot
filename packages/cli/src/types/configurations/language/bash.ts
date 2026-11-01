import type { ScriptSyntax } from '#cli/types/parsers/code.ts';

export type LayoutFinding = { line: number; rule: string; message: string };

export type ScriptFile = ScriptSyntax & {
    path: string;
    lines: string[];
    executable: boolean;
};
