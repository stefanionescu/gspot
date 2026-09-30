// The result shapes of the planted-project builders: what each one hands to its test.
import type { CheckResult } from '#cli/types/checks.ts';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import type { Generated } from '#tests/types/acceptance/source/cli.ts';
import type { HookLocation } from '#cli/types/repository/repository.ts';

export type PrepareCiProjectResult = {
    base: string;
    generated: Generated;
    pipeline: string;
    pipelinePath: string;
    workflowPath: string;
};
export type PrepareHookAdoptionResult = {
    options: {
        cwd: string;
        timeoutMs: number;
        env: Record<string, string>;
    };
    prepare: string[];
    location: HookLocation;
    names: string[];
    original: NonSharedBuffer[];
};
export type PrepareHookCloneResult = {
    main: string;
    options: {
        cwd: string;
        timeoutMs: number;
        env: { PATH: string; [name: string]: string };
    };
    clonePath: string;
    hookTool: 'pre-commit' | 'lefthook' | 'husky' | 'simple-git-hooks';
};
export type PrepareDispatcherResult = {
    root: string;
    directory: string;
    hook: string;
    original: string;
    config: NonSharedBuffer;
    before: NonSharedBuffer;
    env: Record<string, string>;
};
export type PrepareLefthookResult = {
    configuration: string;
    command: string[];
    input: string;
    options: {
        cwd: string;
        stdin: string;
        timeoutMs: number;
        env: Record<string, string>;
    };
    location: HookLocation;
    original: string;
    scriptPath: string;
    originalScript: NonSharedBuffer | undefined;
};
export type PrepareHuskyResult = {
    authored: string;
    original: NonSharedBuffer;
    location: HookLocation;
    config: NonSharedBuffer;
    options: { cwd: string; timeoutMs: number; env: Record<string, string> };
};
export type ReadPackageInputsResult = {
    manifest: NonSharedBuffer;
    lockPath: string;
    lock: NonSharedBuffer;
    mode: number;
    ownershipPath: string;
    ownership: NonSharedBuffer;
};
export type CreatePackageProjectResult = {
    root: string;
    artifacts: string;
    registry: { token: string; url: string; readonly requests: number; [Symbol.asyncDispose](): Promise<void> };
    rootPackage: string;
    yarnConfiguration: string | undefined;
    version: string;
    [Symbol.asyncDispose](): Promise<void>;
};
export type PreparePythonInstallationResult = {
    root: string;
    scopes: Session['scopes'];
    plans: GeneratedFile[];
    rootProject: NonSharedBuffer;
    rootConfiguration: NonSharedBuffer;
    [Symbol.asyncDispose](): Promise<void>;
};
export type CreateSecretVerifierResult = {
    firstToken: string;
    secondToken: string;
    requests: unknown[];
    mode: string;
    [Symbol.asyncDispose](): Promise<void>;
};
export type PrepareSupabaseCheckResult = {
    prefix: string;
    execute: () => Promise<CheckResult>;
    requests: { args: string[]; cwd: string }[];
    [Symbol.dispose](): void;
};
export type PrepareSupabaseDatabaseResult = {
    options: { cwd: string; timeoutMs: number };
    configPath: string;
    authored: NonSharedBuffer;
    version: string;
    [Symbol.asyncDispose](): Promise<void>;
};
export type CreateConsumerResult = {
    installed: SpawnOutcome;
    consumer: string;
    command: string[];
    options: {
        cwd: string;
        env: Record<string, string | undefined>;
        timeoutMs: number;
    };
    setupOptions: { env: Record<string, string>; cwd: string; timeoutMs: number };
    editorconfig: string;
    formatter: string;
    workspace: string;
    [Symbol.asyncDispose]: () => Promise<void>;
};
export type PrepareFormatterConsumerResult = {
    toolConsumer: string;
    toolOptions: {
        cwd: string;
        timeoutMs: number;
        env: Record<string, string | undefined>;
    };
    authoredPackage: string;
};
export type PrepareNativeConsumerResult = {
    nativeConsumer: string;
    nativeOptions: { cwd: string; env: Record<string, string | undefined>; timeoutMs: number };
    authoredPackage: string;
};
