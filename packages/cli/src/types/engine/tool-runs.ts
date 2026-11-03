import type { z } from 'zod';
import type { CHECK_RUNS } from '#cli/config/manifests.ts';
import type { Tool, Check } from '#cli/types/manifests.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { reportedTypoSchema } from '#cli/schemas/engine.ts';
import type { GITLINK_MODE } from '#cli/config/repository/files.ts';
import type { outputSchema } from '#cli/schemas/manifests/checks.ts';
import type { GitFile, TrackedFile } from '#cli/types/repository.ts';
import type { GeneratedFile, ProcessFailure } from '#cli/types/tools.ts';
import type { SpawnResult, SpawnOptions, TemporaryFolder } from '#cli/types/system.ts';
import type { CheckResult, CheckSession, CommandLaunch, CheckRunOptions } from '#cli/types/engine/run.ts';

export type Finding = {
    check: string;
    file: string;
    message: string;
    fixable: boolean;
    explain?: string;
    diff?: string;
    line?: number | undefined;
    column?: number;
    rule?: string;
    fingerprint?: string;
    help?: string;
};

export type CheckFinding = Omit<Finding, 'check' | 'fixable'>;

export type CopyIndexFile = Omit<GitFile, 'mode'> & { mode: Exclude<GitFile['mode'], typeof GITLINK_MODE> };

export type CopyFile = string | { indexFile: CopyIndexFile; bytes: Buffer };

export type CopyPlan = {
    root: string;
    target: string;
    files: Iterable<CopyFile> | AsyncIterable<CopyFile>;
    dependencies: string[];
    cancelSignal?: AbortSignal | undefined;
};

export type CopyPaths = { paths: string[]; dependencies: string[] };

export type DeclarationDependencies = { copies: string[]; mismatched: boolean };

export type RevisionCopy = TemporaryFolder & {
    root: string;
    tree: string;
    unreadablePaths: string[];
    dependencyNote?: string;
};

export type RevisionDependencies = { dependencies: string[]; dependencyNote?: string };

export type ToolOutput = OutputPaths & {
    check: string;
    help: string;
    fixExtensions?: string[] | undefined;
    stdout: string;
    text: string;
    output: CheckOutput;
};

export type CheckOutput = z.output<typeof outputSchema>;

export type OutputPaths = { cwd: string; root: string };

export type ParsingCheck = Partial<Pick<Check, 'fix_extensions'>> & {
    id: string;
    help: string;
    runs: (typeof CHECK_RUNS)[number];
    output: CheckOutput;
    fix?: string[] | undefined;
};

export type OutputParser = {
    parse: (output: ToolOutput) => Finding[];
    namesFiles: (output: CheckOutput) => boolean;
    namesRules: (output: CheckOutput) => boolean;
};

export type ReportedTypo = z.infer<typeof reportedTypoSchema>;

export type ToolProcessResult = { result: SpawnResult; failure: ProcessFailure | undefined };

export type CheckToolOptions = Pick<CommandLaunch, 'cwd'> &
    Partial<Pick<CommandLaunch, 'env'>> &
    Pick<SpawnOptions, 'stdin'> & { tool?: string; exitCodes?: readonly number[] };

export type CommandArgument = string | { file: true };

export type Substitutions = {
    files: string[];
    scope: string;
    root: string;
    messageFile?: string;
};

export type CommandLine = { commandArguments: string[]; file?: string };

export type CheckTool = { name: string; path: string; start: string[]; env: Record<string, string> };

export type CommandSetup = {
    root: string;
    cwd: string;
    files: string[];
    env: Record<string, string>;
    substitutions: Substitutions;
};

export type FolderRun = {
    session: CheckSession;
    planned: PlannedCheck;
    tool: Tool;
    command: string[];
    toolPath: string;
    base: CheckResult;
    options: Pick<CheckRunOptions, 'verbose' | 'command'>;
};

export type CommandRun = { root: string; cwd: string; findings: Finding[]; failed: boolean };

export type CommandLineOutput = { commandLine: CommandLine; result: SpawnResult; findings: Finding[] };

export type ParsedFindings = { findings: Finding[]; note?: undefined } | { findings?: undefined; note: string };

export type OutputCheck = Pick<PlannedCheck, 'check' | 'tool'>;

export type CommandBatch = { files: TrackedFile[]; command: string[] };

export type ConfigGeneration = {
    files: GeneratedFile[];
    targets: ReadonlyMap<string, ReadonlyMap<string, string>>;
    failures: ReadonlyMap<string, ReadonlyMap<string, Error>>;
};

export type ConfigTargets = Pick<ConfigGeneration, 'targets' | 'failures'>;
