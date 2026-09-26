// The types of checks/structure in this package.
import type { z } from 'zod';
import type { Node } from 'web-tree-sitter';
import type { matchSchema } from '#cli/checks/structure/ast-grep.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';

/** One analysis: a function over the context that returns findings. */
export type StructureAnalysis = (
    context: StructureContext,
    scripts: () => Promise<ScriptIndex>,
) => Finding[] | Promise<Finding[]>;
export type Language = 'python' | 'swift' | 'bash';
export type Substance = (node: Node, language: Language, threshold: number) => boolean;
/** What every analysis receives. */
export type StructureContext = {
    input: EngineInput;
    /** The files this check runs over. */
    files: TrackedFile[];
    /** A limit by its `[limits]` key, read for the file's language. */
    limit: (key: string, language?: string) => number | undefined;
    /** A `[tools.bash]` text slot, or the fallback. */
    bashText: (slot: string, otherwise: string) => string;
    /** A `[tools.bash]` list slot, empty when unset. */
    bashList: (slot: string) => string[];
    /** A `[tools.bash]` slot as written. */
    bashSetting: (slot: string) => unknown;
    /** A finding for this check. */
    report: (file: string, line: number, rule: string, message: string) => Finding;
};
export type StructureProblem = { file: string; line: number; rule: string; text: string };
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
export type ScriptReport = (line: number, rule: string, message: string) => void;
export type Edge = ImportIndex['edges'][number];
export type EdgeSource = { input: EngineInput; path: string; owned: Set<string>; scanner: Bun.Transpiler };
export type ImportIndex = {
    paths: string[];
    importers: Map<string, Set<string>>;
    edges: { from: string; to: string; source: string; line: number; column: number }[];
};
/** An entry a directory holds, as the tracked file list sees it. */
export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };
/** A validated native structural match with zero-based line positions. */
export type AstGrepMatch = z.infer<typeof matchSchema>;
/** A line of a shell script with its comment stripped, keyed by its one-based number. */
export type CodeLine = { number: number; code: string };
