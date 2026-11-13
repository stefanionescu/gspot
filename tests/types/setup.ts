import type { Linter } from 'eslint';
import type { z } from 'zod';

import type { miseLockfileSchema } from '#cli/schemas/tools.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import type { Level } from '#cli/types/settings.ts';
import type { SpawnResult } from '#cli/types/system.ts';

export type SandboxWrite = {
    files: Record<string, string>;
    settings: string;
    removed: readonly string[];
    executable: readonly string[];
};

type WorkflowStep = {
    name?: string;
    run?: string;
    uses?: string;
    if?: string;
    env?: Record<string, string>;
};

export type GithubWorkflow = {
    jobs: Record<string, { name?: string; 'runs-on': string; steps: WorkflowStep[] }>;
};

export type GitlabPipeline = { gspot: { script: string[] } };

export type GspotProject = AsyncDisposable & {
    root: string;
    workspace: string;
    environment: Record<string, string>;
    online: Sandbox;
    offline: Sandbox;
};

export type RegistryPackage = {
    name: string;
    source: string;
    version: string;
    bin?: Record<string, string> | undefined;
    dependencies?: Record<string, string> | undefined;
    peerDependencies?: Record<string, string> | undefined;
};

export type PackedPackage = Omit<RegistryPackage, 'source'> & { filename: string; integrity: string };

export type NpmRegistry = Disposable & { url: string; npmrc: string; requests: string[] };

export type NpmProject = {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    rootPackage: string;
    [Symbol.asyncDispose](): Promise<void>;
};

export type ToolProjectFiles = {
    projectFile: Buffer<ArrayBuffer>;
    lockfilePath: string;
    lockfile: Buffer<ArrayBuffer>;
    mode: number;
};

export type PythonProject = AsyncDisposable & {
    rootProject: Buffer<ArrayBuffer>;
    rootConfiguration: Buffer<ArrayBuffer>;
};

type MiseVersion = z.infer<typeof miseLockfileSchema>['tools'][string][number];

export type MiseProject = { tools: Record<string, string | MiseVersion> };

export type PausedGit = { pid: number; checkout?: string };

export type ProcessOutput = Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>;

export type TerminalCapture = DisposableStack & { stdout: string[]; stderr: string[] };

export type StdinOptions = { stdin?: string | Uint8Array };

export type ProcessCapture = Pick<
    Bun.Subprocess<Bun.Spawn.Writable, 'pipe', 'pipe'>,
    'stdout' | 'stderr' | 'exitCode' | 'kill' | 'exited'
>;

export type ChildCapture = AsyncDisposable & { stdout: Promise<string>; stderr: Promise<string> };

export type ProgramName =
    | 'fakes/tool'
    | 'checks/search'
    | 'checks/replacement'
    | 'checks/arguments'
    | 'checks/contents'
    | 'checks/staged'
    | 'checks/dependency'
    | 'processes/output'
    | 'processes/descendant'
    | 'processes/process-group'
    | 'checks/stylelint'
    | 'processes/modules'
    | 'processes/node-version'
    | 'processes/cli'
    | 'processes/command'
    | 'fakes/git'
    | 'fakes/swift'
    | 'fakes/xcodebuild'
    | 'processes/revisions'
    | 'processes/assets'
    | 'fakes/generator'
    | 'fakes/site-build'
    | 'fakes/package-bin';

export type CallRecord = {
    arguments: string[];
    environment: Record<string, string | null>;
    cwd: string;
    stdin?: string;
};

export type FindingRow = { file: string; line: number | undefined; rule: string | undefined };

type SampleFinding = Partial<Pick<Finding, 'file' | 'rule' | 'line' | 'column' | 'message'>>;

export type CheckSample = SandboxChanges & {
    check: string;
    apply?: boolean | undefined;
    expected: SampleFinding;
    findings?: readonly SampleFinding[];
    corrected?: SampleFix;
};

export type SandboxChanges = {
    files: Record<string, string>;
    settings?: string | undefined;
    removed?: readonly string[] | undefined;
    executable?: readonly string[] | undefined;
};

export type SampleFix = Omit<SandboxChanges, 'executable'>;

export type SandboxPlan = {
    configurations: readonly string[];
    dependencies?: Readonly<Record<string, string>>;
    files: Readonly<Record<string, string>>;
    json?: Readonly<Record<string, unknown>>;
    level?: Level;
    cleanSource?: string;
    executable?: readonly string[];
};

export type InstalledSandboxPlan = SandboxPlan & {
    without?: readonly string[];
    install?: false;
    commands?: ReadonlyArray<readonly string[]>;
};

export type Sandbox = {
    root: string;
    run: GspotCall;
};

type GspotCall = (cwd: string, commandArguments: readonly string[]) => Promise<ProcessOutput>;

export type LintFinding = { rule: Linter.LintMessage['ruleId']; file: string; line: Linter.LintMessage['line'] };

export type EslintConfiguration = {
    rules: Record<string, [Linter.Severity, ...unknown[]]>;
    settings: { next?: { rootDir: string } | undefined } & Record<string, unknown>;
};
