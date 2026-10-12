import type { SqlFile } from '#cli/types/parsers/sql.ts';
import type { ScriptSyntax } from '#cli/types/parsers/bash.ts';
import type { SafeFolder } from '#cli/types/system/safe-folder.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import type { FENCE_PARSERS } from '#cli/config/checks/language/markdown.ts';

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

export type SqlSource = { path: string; text: string };

export type SqlFileInput = {
    input: CheckInput;
    source: SqlSource;
    parsed: SqlFile;
    statementLimit: number;
    parameterLimit: number;
};

/** Findings and measured triviality of one `CREATE FUNCTION` statement. */
export type SqlFunctionFindings = { findings: Finding[]; isTrivial: boolean };

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
export type PreparedSwiftBuild = { files: SafeFolder; source: string };

export type FenceParser = (typeof FENCE_PARSERS)[keyof typeof FENCE_PARSERS];

/** The body and opening line of a language-tagged Markdown code fence. */
export type FencedBlock = { line: number; language: string; body: string };

/** One canonical syntax reader selected by the declared fence aliases. */

/** A syntax diagnostic at a one-based line of a code body or Markdown source. */
export type FenceSyntaxError = { line: number; message: string };

/** The styles accepted by the native Python docstring checker. */
export type PythonDocstringStyle = 'google' | 'numpy' | 'sphinx';

export type ParsedHtml = { templates: string[] };
