import type { ScriptSyntax } from '#cli/types/parsers/bash.ts';
import { type Files, type ReadCache } from '#cli/types/system/files.ts';
import type { DOCSTRING_STYLES } from '#cli/config/checks/language/python.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import type { FENCE_PARSER_NAMES } from '#cli/config/checks/language/markdown.ts';

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

/** Docstring arguments and the authored or inherited style, before source detection. */
export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

/** The build of one Swift scope. */
export type SwiftBuildPlan = {
    /** The build folder of this scope. */
    folder: string;
    /** The compiler log destination. */
    log: string;
    commandArguments: string[];
    /** The analyzer clears this folder so its log includes every compiler call. */
    scratch?: string;
};

/** The read build status and its compiler output. */
export type SwiftBuildOutput = { code: number; output: string; source: string };

/** The separate build state for each Swift task. */
export type SwiftBuildPurpose = 'compile' | 'analyze' | 'coverage' | 'periphery';

/** The prepared source copy and its locked root, which the caller disposes. */
export type PreparedSwiftBuild = { files: Files; source: string };

export type FenceParser = (typeof FENCE_PARSER_NAMES)[number];

/** The body and opening line of a language-tagged Markdown code fence. */
export type FencedBlock = { line: number; language: string; body: string };

/** A syntax error at a one-based line of a code body or Markdown source. */
export type FenceSyntaxError = { line: number; message: string };

/** The styles accepted by the Python docstring checker. */
export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];

/** Referenced compiler projects whose outputs stay inside the caller-owned scratch copy. */
export type TypeScriptReferenceCopy = {
    root: string;
    scratchRoot: string;
    reads: ReadCache;
    projects: Map<string, TypeScriptConfiguration>;
};

export type ParsedJavascript = { script_files: string[] };

export type ParsedSwift = {
    xcode_project?: string | undefined;
    xcode_scheme?: string | undefined;
    xcode_destination: string;
};
