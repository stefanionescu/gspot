// The types of checks/language/bash in this package.
import type { z } from 'zod';
import type { matchSchema } from '#cli/checks/language/bash/ast-grep.ts';

/** One shell function: its name, its declaration line and closing line (one-based), and the lines between the braces. */
export type ScriptFunction = { name: string; start: number; end: number; body: string[]; statements: number };

/** One shell script the engine reads. */
export type ScriptFile = {
    path: string;
    text: string;
    lines: string[];
    functions: ScriptFunction[];
    isExecutable: boolean;
    /** Identifier tokens outside declaration lines, by name, with the lines they appear on. */
    references: Map<string, number[]>;
    /** Names assigned at the top level, outside every function. */
    assignments: Set<string>;
};

/** The shell scripts of one scope, with the function owners across them. */
export type ScriptIndex = { files: ScriptFile[]; owners: Map<string, string> };

/** How an analysis reports one problem in one file. */
export type ScriptReport = (line: number, rule: string, text: string) => void;

/** A validated native structural match with zero-based line positions. */
export type AstGrepMatch = z.infer<typeof matchSchema>;

/** A line of a shell script with its comment stripped, keyed by its one-based number. */
export type CodeLine = { number: number; code: string };
