import type { Session } from '#cli/types/session.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { ProcessFailure } from '#cli/types/tools/run.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { SpawnResult, SpawnOptions } from '#cli/types/system/processes.ts';
import type { Finding, CheckResult, CheckRunOptions } from '#cli/types/runs/check.ts';

export type ToolProcessResult = { result: SpawnResult; failure: ProcessFailure | undefined };

export type CheckToolProgram = { tool: string; modulePath: string };

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

export type CommandLine = { commandArguments: string[]; file?: string };

export type CheckTool = { name: string; path: string; env: Record<string, string> };

export type CommandSetup = {
    root: string;
    cwd: string;
    files: string[];
    env: Record<string, string>;
    substitutions: Substitutions;
};

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

export type CommandRun = { root: string; cwd: string; findings: Finding[]; failed: boolean };

export type CommandLineOutput = { commandLine: CommandLine; result: SpawnResult; findings: Finding[] };

export type ParsedFindings = { findings: Finding[]; note?: undefined } | { findings?: undefined; note: string };

export type OutputCheck = Pick<PlannedCheck, 'check' | 'tool'>;

export type CommandGroup = { files: TrackedFile[]; command: string[] };
