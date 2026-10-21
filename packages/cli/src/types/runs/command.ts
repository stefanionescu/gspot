import type { Session } from '#cli/types/session.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { ProcessFailure } from '#cli/types/tools/run.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { SpawnResult, SpawnOptions } from '#cli/types/system/processes.ts';
import type { Finding, CheckResult, CheckRunOptions } from '#cli/types/runs/check.ts';

/** The process result and its interpreted execution failure. */
export type ToolProcessResult = { result: SpawnResult; failure: ProcessFailure | undefined };

/** The public API of a tool, run by a shipped, supervised program. */
export type CheckToolProgram = { tool: string; entry: string };

/** The working folder, environment, and input of a nested tool. */
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
export type CommandLine = { commandArguments: string[]; file?: string };

/** A nested tool resolved to its executable and environment. */
export type CheckTool = { name: string; path: string; env: Record<string, string> };

/** Scoped paths and environment values for inspecting and running a command. */
export type CommandSetup = {
    root: string;
    cwd: string;
    files: string[];
    env: Record<string, string>;
    substitutions: Substitutions;
};

/** A check command expanded into bounded invocations. */
export type PreparedCommand = {
    root: string;
    cwd: string;
    commandArguments: string[];
    commandLines: CommandLine[];
    env: Record<string, string>;
};

export type CommandRun = {
    session: Session;
    planned: PlannedCheck;
    tool: Tool;
    command: string[];
    toolPath: string;
    setup: CommandSetup;
    base: CheckResult;
    options: CheckRunOptions;
};

/** The findings and process status across the commands of one check. */
export type CommandRunState = { root: string; cwd: string; findings: Finding[]; failed: boolean };

/** Captured output before file and scope attribution. */
export type CommandLineOutput = { commandLine: CommandLine; result: SpawnResult; findings: Finding[] };

/** Parsed findings, or a note that refuses the output. */
export type ParsedFindings = { findings: Finding[]; note?: undefined } | { findings?: undefined; note: string };

/** The check data for parsing output and telling a process crash from findings. */
export type OutputCheck = Pick<PlannedCheck, 'check' | 'tool'>;

export type CommandGroup = { files: TrackedFile[]; command: string[] };
