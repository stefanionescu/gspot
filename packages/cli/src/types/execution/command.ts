import type { ToolPin } from '#cli/types/configurations.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { CheckResult, PlannedCheck } from '#cli/types/execution/runtime.ts';

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
export type EngineTool = { path: string; env: Record<string, string> };

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
    session: Session;
    planned: PlannedCheck;
    tool: ToolPin;
    command: string[];
    toolPath: string;
    environment: CommandEnvironment;
    base: CheckResult;
};
