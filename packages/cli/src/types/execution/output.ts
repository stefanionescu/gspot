import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { CommandInvocation } from '#cli/types/execution/command.ts';
import type { Finding, PlannedCheck } from '#cli/types/execution/runtime.ts';

/** Findings and process status accumulated across one check's commands. */
export type CommandRunState = { root: string; cwd: string; findings: Finding[]; isFailed: boolean };

/** Captured output before file and scope attribution. */
export type InvocationOutput = { invocation: CommandInvocation; result: SpawnResult; findings: Finding[] };

/** Parsed findings or the diagnostic explaining why output was refused. */
export type ParsedFindings = { findings: Finding[]; note?: undefined } | { findings?: undefined; note: string };

/** Check metadata for parsing output and distinguish a process crash from findings. */
export type OutputCheck = Pick<PlannedCheck, 'spec' | 'tool' | 'manifest'>;
