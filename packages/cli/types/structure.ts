import type { EngineInput } from '#types/run.ts';
// Type aliases of the structure engine.
import type { Finding } from '#types/finding.ts';
import type { TrackedFile } from '#types/repository.ts';

/** One shell function: its name, its declaration line and closing line (one-based), and the lines between the braces. */
export type ScriptFunction = { name: string; start: number; end: number; body: string[] };

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

/** An entry a directory holds, as the tracked file list sees it. */
export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };

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

/** One analysis: a function over the context that returns findings. */
export type Analysis = (context: StructureContext, scripts: () => Promise<ScriptIndex>) => Promise<Finding[]>;

/** How an analysis reports one problem in one file. */
export type ScriptReport = (line: number, rule: string, message: string) => void;

/** One ast-grep match. */
export type AstGrepMatch = { file: string; ruleId: string; range: { start: { line: number }; end: { line: number } } };

/** A line of a shell script with its comment stripped, keyed by its one-based number. */
export type CodeLine = { number: number; code: string };

export type ImportIndex = { paths: string[]; importers: Map<string, Set<string>> };
