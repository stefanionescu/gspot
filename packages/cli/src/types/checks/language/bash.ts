import type { z } from 'zod';
import type { ScriptSyntax } from '#cli/types/parsers/bash.ts';
import type { matchSchema } from '#cli/parsers/schema/ast-grep.ts';

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

/** The shell scripts of one scope, with the function owners across them. */
export type ScriptIndex = { files: ScriptFile[]; owners: Map<string, string> };

/** A validated native structural match with zero-based line positions. */
export type AstGrepMatch = z.infer<typeof matchSchema>;

/** One structural shell count and the limit it measures. */
export type BashCountRule = { limit: string; noun: string; isDepth: boolean };
