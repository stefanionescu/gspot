import type { z } from 'zod';
import type { AsyncSpawnOptions } from '#cli/types/system/system.ts';
import type { lintRuleDocsSchema } from '#cli/schemas/tools/tools.ts';

export type LintRuleDocs = z.infer<typeof lintRuleDocsSchema>;

export type ToolRunOptions = Pick<AsyncSpawnOptions, 'cwd' | 'env' | 'stdin'> & {
    timeoutSeconds: number;
    cancelSignal?: AbortSignal | undefined;
};

export type ToolAvailability = { path: string } | ProcessFailure;
export type ProcessFailure = { status: 'error' | 'missing'; note: string };

export type InstalledDependency = { path: string; version: string | undefined };

export type RuleDocsOptions = {
    timeoutSeconds?: number | undefined;
    readMiseBinPaths?: (() => string[]) | undefined;
};

export type RuleToolSearch = RuleDocsOptions & { timeoutSeconds: number };
