import type { Finding } from '#cli/checks/result.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import type { PolicyFiles } from '#cli/policy/read.ts';
import type { ToolContext } from '#cli/tools/probe.ts';
import type { Repository } from '#cli/repository/tree.ts';
import type { ScopeEntry } from '#cli/repository/scopes.ts';
import type { ScopeSelection } from '#cli/policy/resolve.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import type { SourceObservations } from '#cli/repository/tracked.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import type { DriftEntry } from '#cli/lifecycle/drift.ts';

export type EngineInput = {
    policyFiles: PolicyFiles;
    selection: ScopeSelection;
    manifests: Map<string, Manifest>;
    probes: ToolContext['probes'];
    scopeEntries: ScopeEntry[];
    attributes: Repository['attributes'];
    hasGit: boolean;
    observations: SourceObservations;
    resources?: DisposableStack;
    cancelSignal?: AbortSignal;
    scopeRoot: string;
    repositoryFiles?: TrackedFile[];
    generatedDrift?: () => DriftEntry[];
    suppressions?: SuppressionComment[];
    root: string;
    scope: string;
    view: MergedView;
    spec: CheckSpec;
    files: TrackedFile[];
    staged?: Set<string>;
};

export type EngineOutcome = { findings: Finding[]; checkedFiles: string[] };

export type Engine = (input: EngineInput) => Finding[] | EngineOutcome | Promise<Finding[] | EngineOutcome>;

export type SuppressionComment = { file: string; line: number; form: string; reason?: string; forbidden: boolean };
