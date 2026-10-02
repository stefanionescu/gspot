// The types of execution/tool in this package.
import type { z } from 'zod';
import type { outputSchema } from '#cli/kits/output.ts';
import type { Root } from '#cli/types/platform/platform.ts';
import type { ToolPin, CheckSpec } from '#cli/types/kits.ts';
import type { typosEntry } from '#cli/execution/tool/reports.ts';
import type { Session, ToolInspection } from '#cli/types/tools/tools.ts';
import type { Finding, CheckResult, PlannedCheck } from '#cli/types/execution/execution.ts';

/** What one tool run accumulates across its spawns. */
export type ToolRunState = { root: string; cwd: string; findings: Finding[]; isFailed: boolean };

export type CommandPart = string | { file: true };
export type Substitutions = {
    files: string[];
    scope: string;
    root: string;
    messageFile?: string;
    indent: number;
};

/** A tool command expanded and ready to spawn: once, or once per file. */
export type ToolInvocation = { argv: string[]; file?: string };

export type ToolRun = {
    session: Session;
    planned: PlannedCheck;
    tool: ToolPin;
    command: string[];
    inspection: ToolInspection;
    base: CheckResult;
};

export type Copy = { source: string; target: string };
export type Scratch = {
    root: string;
    scratch: string;
    files: Root;
    copies: Map<string, string>;
    pending: Copy[];
    fileLinks: Copy[];
};

/** What the regex output parser needs per line: the format, the compiled fixable pattern, and the help text. */
export type RegexParser = { output: OutputFormat; fixable: RegExp | undefined; help: string };
export type Parsing = { spec: CheckSpec; stdout: string; text: string; root: string; cwd: string };
export type TypoEntry = z.infer<typeof typosEntry>;

/** The output fields accepted by both configuration and repository checks. */
export type OutputFormat = z.infer<typeof outputSchema>;
