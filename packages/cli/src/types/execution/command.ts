import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';
import type { SpawnResult, SpawnOptions } from '#cli/types/platform/runtime.ts';

/** A selected tool's public API executed by a bundled, supervised native program. */
export type CheckToolProgram = { tool: string; entry: string };

/** The working directory, environment, and input of a nested tool. */
export type CheckToolOptions = Pick<PreparedCommand, 'cwd'> &
    Partial<Pick<PreparedCommand, 'env'>> &
    Pick<SpawnOptions, 'stdin'>;

export type CommandPart = string | { file: true };

export type Substitutions = {
    files: string[];
    scope: string;
    root: string;
    messageFile?: string;
    indent: number;
};

/** An expanded command ready to spawn once or once per file. */
export type CommandInvocation = { argv: string[]; file?: string };

/** A nested tool resolved to its selected executable and environment. */
export type CheckTool = { name: string; path: string; env: Record<string, string> };

/** Scoped paths and environment values for inspecting and execute a command. */
export type CommandEnvironment = {
    root: string;
    cwd: string;
    files: string[];
    env: Record<string, string>;
    substitutions: Substitutions;
};

/** A scoped command expanded into bounded invocations. */
export type PreparedCommand = {
    root: string;
    cwd: string;
    argv: string[];
    commands: CommandInvocation[];
    env: Record<string, string>;
};

export type CommandRun = {
    session: ToolSession;
    planned: PlannedCheck;
    tool: ToolPin;
    command: string[];
    toolPath: string;
    environment: CommandEnvironment;
    base: CheckResult;
};

/** Findings and process status accumulated across one check's commands. */
export type CommandRunState = { root: string; cwd: string; findings: Finding[]; isFailed: boolean };

/** Captured output before file and scope attribution. */
export type InvocationOutput = { invocation: CommandInvocation; result: SpawnResult; findings: Finding[] };

/** Parsed findings or the diagnostic explaining why output was refused. */
export type ParsedFindings = { findings: Finding[]; note?: undefined } | { findings?: undefined; note: string };

/** Check metadata for parsing output and distinguish a process crash from findings. */
export type OutputCheck = Pick<PlannedCheck, 'check' | 'tool' | 'manifest'>;
