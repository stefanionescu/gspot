import type { z } from 'zod';
import type { Finding } from '#cli/types/execution/runtime.ts';
import type { matchSchema } from '#cli/parsers/schema/ast-grep.ts';
import type { ScriptSyntax, ScriptFunction } from '#cli/types/parsers/bash.ts';

/** How an analysis reports one problem in one file. */
export type ScriptReport = (line: number, rule: string, text: string) => void;

/** One parsed shell source owned by an engine. */
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

/** A shell script's declared source dependencies and annotation findings. */
export type SourceAnnotations = { sources: Set<string>; findings: Finding[] };
/** One shell function's repository location for duplicate-body reports. */
export type FunctionLocation = Pick<ScriptFunction, 'name'> & { file: string; line: number };
