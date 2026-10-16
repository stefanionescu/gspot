import type { ScriptSyntax } from '#cli/types/parsers/bash.ts';
import { type Files, type ReadCache } from '#cli/types/system/files.ts';
import type { FENCE_PARSERS } from '#cli/config/checks/language/markdown.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';

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

/** Native docstring arguments and the authored or inherited style, before source detection. */
export type DocstringConfiguration = { command: string[]; style: PythonDocstringStyle | undefined };

/** The build of one Swift scope. */
export type SwiftBuildPlan = {
    /** The build folder of this scope. */
    folder: string;
    /** The compiler log destination. */
    log: string;
    argv: string[];
    /** The analyzer clears this folder so its log includes every compiler call. */
    scratch?: string;
};

/** The read build status and its compiler output. */
export type SwiftBuildOutput = { code: number; output: string; source: string };

/** Independent build state for each native Swift consumer. */
export type SwiftBuildPurpose = 'compile' | 'analyze' | 'coverage' | 'periphery';

/** Prepared source copy and its locked root, disposed by the native consumer. */
export type PreparedSwiftBuild = { files: Files; source: string };

export type FenceParser = (typeof FENCE_PARSERS)[keyof typeof FENCE_PARSERS];

/** The body and opening line of a language-tagged Markdown code fence. */
export type FencedBlock = { line: number; language: string; body: string };

/** One canonical syntax reader selected by the declared fence aliases. */

/** A syntax diagnostic at a one-based line of a code body or Markdown source. */
export type FenceSyntaxError = { line: number; message: string };

/** The styles accepted by the native Python docstring checker. */
export type PythonDocstringStyle = 'google' | 'numpy' | 'sphinx';

/** Referenced compiler projects whose outputs stay inside the caller-owned scratch copy. */
export type TypeScriptReferenceCopy = {
    root: string;
    scratchRoot: string;
    reads: ReadCache;
    projects: Map<string, TypeScriptConfiguration>;
};
