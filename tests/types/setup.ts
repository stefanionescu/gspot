import type { z } from 'zod';
import type { Linter } from 'eslint';
import type { Level } from '#cli/types/settings.ts';
import type { RunReport } from '#cli/types/engine/run.ts';
import type { ManagedKeys } from '#cli/types/repository.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import type { ToolPackageManager } from '#cli/types/tools.ts';
import type { miseLockfileSchema } from '#cli/schemas/tools.ts';
import type { PROGRAM_NAMES } from '#tests/config/setup/programs.ts';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system.ts';

export type SandboxWrite = {
    files: Record<string, string>;
    settings: string;
    removed: readonly string[];
    executable: readonly string[];
};

type WorkflowStep = {
    name?: string;
    id?: string;
    run?: string;
    uses?: string;
    if?: string;
    env?: Record<string, string>;
    with?: Record<string, string>;
};

export type GithubWorkflow = {
    name: string;
    permissions: Record<string, string>;
    jobs: Record<string, { name?: string; if?: string; 'runs-on': string; steps: WorkflowStep[] }>;
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

export type NpmRegistry = Disposable & { url: string; npmrc: string; requests: number };

export type NpmProject = {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    rootPackage: string;
    yarnConfiguration: string | undefined;
    toolPackageManager: ToolPackageManager['name'];
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

export type ToolPackageJson = {
    name: 'tools';
    private: true;
    devDependencies: Record<string, string>;
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

export type ProcessBackend = {
    name: string;
    run: (command: string[], options: AsyncSpawnOptions) => SpawnResult | Promise<SpawnResult>;
};

export type ProgramName = (typeof PROGRAM_NAMES)[number];

export type FindingRow = { file: string; line: number | undefined; rule: string | undefined };

export type ScopeFindingRow = FindingRow & { scope: string };

type SampleFinding = Partial<Pick<Finding, 'file' | 'rule' | 'line' | 'column' | 'message'>>;

export type SampleFix = {
    files: Record<string, string>;
    settings?: string;
    removed?: readonly string[] | undefined;
};

export type CheckSample = SandboxChanges & {
    check: string;
    expected: SampleFinding;
    findings?: readonly SampleFinding[];
    corrected?: SampleFix;
};

export type SampleResult = {
    failed: ProcessOutput & { report: RunReport };
    passed: ProcessOutput & { report: RunReport };
};

export type SandboxChanges = {
    files: Record<string, string>;
    settings?: string | undefined;
    removed?: readonly string[] | undefined;
    executable?: readonly string[] | undefined;
};

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
    commands?: readonly (readonly string[])[];
};

export type Sandbox = {
    root: string;
    run: GspotCall;
};

type GspotCall = (cwd: string, commandArguments: readonly string[]) => Promise<ProcessOutput>;

export type LintFinding = { rule: Linter.LintMessage['ruleId']; file: string; line: Linter.LintMessage['line'] };

export type EslintConfiguration = {
    rules: Record<string, [Linter.Severity, ...unknown[]]>;
    languageOptions: { globals: Record<string, string | boolean>; sourceType: string };
    plugins: Record<string, unknown>;
    settings: { next?: { rootDir: string } | undefined } & Record<string, unknown>;
    linterOptions: { reportUnusedDisableDirectives: Linter.Severity };
};

export type PackageFieldScenario = {
    project: Readonly<Record<string, string>>;
    configurations: readonly string[];
    tables: string;
    unchanged: readonly string[];
    changes: ManagedKeys[];
};
