// The types of checks in this package.
import type { z } from 'zod';
import type { Node } from 'web-tree-sitter';
import type { ToolContext } from '#cli/types/tools/tools.ts';
import type { SqlFile } from '#cli/types/parsers/sql.ts';
import type { configurationSchema } from '#cli/checks/licenses.ts';
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';
import type { CheckSpec, Manifest } from '#cli/types/configurations.ts';
import type { checkResultSchema, findingSchema } from '#cli/checks/result.ts';
import type { Defined, MergedView, PolicyFiles, ScopeSelection } from '#cli/types/policy/policy.ts';
import type { Repository, ScopeEntry, SourceObservations, TrackedFile } from '#cli/types/repository/repository.ts';

export type SqlSource = { path: string; text: string };
export type FunctionOption = {
    DefElem: { defname: string; arg: { String?: { sval: string }; List?: { items: { String: { sval: string } }[] } } };
};
export type SqlAnalysis = {
    input: EngineInput;
    source: SqlSource;
    parsed: SqlFile;
    threshold: number;
    maximum: number;
};
export type LicenseException = z.infer<typeof configurationSchema>['packages_allowed'][number];
export type Translations = { directory?: string; base?: string };
export type EngineInput = {
    policyFiles: PolicyFiles;
    selection: ScopeSelection;
    manifests: Map<string, Manifest>;
    inspections: ToolContext['inspections'];
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
export type Finding = Defined<z.infer<typeof findingSchema>>;
export type CheckResult = Defined<Omit<z.infer<typeof checkResultSchema>, 'findings'>> & {
    findings: Finding[];
};
export type Importer = { path: string; read: string[] };
export type MarkupProblem = { node: Node; rule: string; text: string };
