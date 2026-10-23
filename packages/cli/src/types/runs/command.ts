import type { Session } from '#cli/types/session.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { ProcessFailure } from '#cli/types/tools/run.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { SpawnResult, SpawnOptions } from '#cli/types/system/processes.ts';
import type { Finding, CheckResult, CheckRunOptions } from '#cli/types/runs/check.ts';

/** The process result and its process failure, if any. */
export type ToolProcessResult = { result: SpawnResult; failure: ProcessFailure | undefined };

/** The public API of a tool that a shipped, supervised program runs. */
export type CheckToolProgram = { tool: string; modulePath: string };

/** The working folder, environment, and standard input of a tool that a built-in check runs. */
export type CheckToolOptions = Pick<CommandLaunch, 'cwd'> &
    Partial<Pick<CommandLaunch, 'env'>> &
    Pick<SpawnOptions, 'stdin'>;

export type CommandArgument = string | { file: true };

export type Substitutions = {
    files: string[];
    scope: string;
    root: string;
    messageFile?: string;
    indent: number;
};

/** An expanded command ready to spawn once or once per file. */
export type CommandLine = { commandArguments: string[]; file?: string };

/** A tool that a built-in check runs, and the executable and environment it runs with. */
export type CheckTool = { name: string; path: string; env: Record<string, string> };

/** Scoped paths and environment values for inspecting and running a command. */
export type CommandSetup = {
    root: string;
    cwd: string;
    files: string[];
    env: Record<string, string>;
    substitutions: Substitutions;
};

/**
 * A check command ready to run: its folders, its arguments, the runs that it splits into to fit the system argument
 * limit, and its environment.
 */
export type CommandLaunch = {
    root: string;
    cwd: string;
    commandArguments: string[];
    commandLines: CommandLine[];
    env: Record<string, string>;
};

export type CopyRun = {
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
export type CommandRun = { root: string; cwd: string; findings: Finding[]; failed: boolean };

/** One run of a command: its arguments, its output, and the findings read from that output. */
export type CommandLineOutput = { commandLine: CommandLine; result: SpawnResult; findings: Finding[] };

/** Parsed findings, or a note that refuses the output. */
export type ParsedFindings = { findings: Finding[]; note?: undefined } | { findings?: undefined; note: string };

/** The fields of a check that output parsing and crash detection read. */
export type OutputCheck = Pick<PlannedCheck, 'check' | 'tool'>;

export type CommandGroup = { files: TrackedFile[]; command: string[] };
