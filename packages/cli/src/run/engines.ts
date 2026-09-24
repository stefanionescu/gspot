import { join } from 'node:path';
import { computeDrift } from '#cli/emit/drift.ts';
import { valeFindings } from '#cli/prose/vale.ts';
import type { PlannedCheck } from '#cli/run/plan.ts';
import { checkActions } from '#cli/checks/actions.ts';
import { resolveNaming } from '#cli/naming/engine.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import { runToolCheck } from '#cli/run/tool-runner.ts';
import { sourceBans } from '#cli/prose/source-bans.ts';
import { resolveIntegrity } from '#cli/checks/dispatch.ts';
import type { ScopeEntry } from '#cli/repository/scopes.ts';
import type { ToolContext } from '#cli/tools/tool-probe.ts';
import { resolveStructure } from '#cli/structure/engine.ts';
import type { PolicyFiles } from '#cli/policy/read-policy.ts';
import { MissingToolError } from '#cli/tools/missing-tool.ts';
import { checkSwiftlint } from '#cli/structure/swift/lint.ts';
// Dispatch to the built-in engines by `engine =` in the manifest.
import type { CheckSpec } from '#cli/configurations/schema.ts';
import type { Finding, CheckResult } from '#cli/output/schema.ts';
import type { Session, ScopeSelection } from '#cli/run/session.ts';
import { SkippedCheckError } from '#cli/platform/skipped-check.ts';
import { checkSecretHistory } from '#cli/checks/secrets/history.ts';
import { checkCommitMessages } from '#cli/checks/commit-messages.ts';
import type { Manifest } from '#cli/configurations/read-manifests.ts';
import { checkVerifiedSecrets } from '#cli/checks/secrets/verified.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';
import type { Repository, SourceObservations } from '#cli/repository/tree.ts';
import { checkJavascript, checkTypescript } from '#cli/checks/typescript/tsc.ts';

const engines: Record<NonNullable<CheckSpec['engine']>, (spec: CheckSpec) => Engine> = {
    integrity: resolveIntegrity,
    naming: resolveNaming,
    structure: resolveStructure,
    prose(spec) {
        if (spec.analysis === 'vale') return valeFindings;
        if (spec.analysis === 'source-bans') return sourceBans;
        throw new Error(`No prose analysis is called ${spec.analysis ?? ''}.`);
    },
};

// Classify missing tools and unmet prerequisites separately from engine errors.
function failureOf(name: string, error: unknown): Pick<CheckResult, 'status' | 'note'> {
    if (error instanceof SkippedCheckError) return { status: 'skipped', note: error.message };
    if (error instanceof MissingToolError) return { status: 'missing', note: error.message };
    return { status: 'error', note: `the ${name} engine failed: ${(error as Error).message}` };
}

/**
 * Supply execution services and selected files without exposing the repository session.
 * @param session
 * @param planned
 */
export function engineInput(session: Session, planned: Pick<PlannedCheck, 'scope' | 'spec' | 'files'>): EngineInput {
    const input: EngineInput = {
        root: session.root,
        scope: planned.scope.scope.path,
        scopeRoot: join(session.root, planned.scope.scope.path),
        view: planned.scope.view,
        spec: planned.spec,
        files: planned.files,
        policyFiles: session.policyFiles,
        selection: planned.scope,
        manifests: session.manifests,
        probes: session.probes,
        scopeEntries: session.repository.scopes,
        attributes: session.repository.attributes,
        hasGit: session.repository.hasGit,
        observations: session.observations,
        ...(session.resources === undefined ? {} : { resources: session.resources }),
        ...(session.cancelSignal === undefined ? {} : { cancelSignal: session.cancelSignal }),
    };
    if (planned.spec.runs === 'once') {
        input.repositoryFiles = session.repository.files;
        if (planned.spec.analysis === 'generated-drift') input.generatedDrift = () => computeDrift(session);
        if (planned.spec.analysis === 'suppressions')
            input.suppressions = suppressionComments(
                session,
                planned.files.filter((file) => file.nature === 'source' && file.tags.includes('text')),
            );
    }
    return input;
}

/**
 * Runs one planned engine check.
 * @param session the session
 * @param engine the selected implementation
 * @param planned the check to run
 * @param staged the staged paths, in staged mode
 * @returns the check result with its findings
 */
export async function runEngineCheck(
    session: Session,
    engine: Engine,
    planned: PlannedCheck,
    staged?: Set<string>,
): Promise<CheckResult> {
    const { spec, scope } = planned;
    const base: CheckResult = {
        check: spec.name,
        scope: scope.scope.path,
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
    };
    const name = spec.engine;
    const started = performance.now();
    try {
        const input = engineInput(session, planned);
        if (staged) input.staged = staged;
        const outcome = await engine(input);
        const findings = Array.isArray(outcome) ? outcome : outcome.findings;
        const checkedFiles = Array.isArray(outcome) ? undefined : [...new Set(outcome.checkedFiles)];
        const allowedFiles = input.repositoryFiles ?? input.files;
        if (checkedFiles?.some((path) => !allowedFiles.some((file) => file.path === path)))
            throw new Error('The engine reported coverage for a file outside its supplied source inventory.');
        for (const finding of findings) {
            if (name !== undefined) finding.engine = name;
            finding.help ??= spec.help;
        }
        return {
            ...base,
            ...(checkedFiles === undefined ? {} : { checkedFiles, files: checkedFiles.length }),
            status: findings.length > 0 ? 'fail' : 'ok',
            duration: performance.now() - started,
            findings,
        };
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...failureOf(name ?? spec.name, error) };
    }
}

/**
 * Select an implementation before execution starts.
 * @param spec the selected check definition
 */
export function resolveCheck(
    spec: CheckSpec,
): (session: Session, planned: PlannedCheck, staged?: Set<string>) => Promise<CheckResult> {
    if (spec.engine !== undefined) {
        const engine = engines[spec.engine](spec);
        return (session, planned, staged) => runEngineCheck(session, engine, planned, staged);
    }
    if (spec.analysis === 'verified-secrets') return checkVerifiedSecrets;
    if (spec.analysis === 'gitleaks-history') return checkSecretHistory;
    if (spec.analysis === 'commit-messages') return checkCommitMessages;
    if (spec.analysis === 'typescript') return checkTypescript;
    if (spec.analysis === 'javascript') return checkJavascript;
    if (spec.analysis === 'swiftlint') return checkSwiftlint;
    if (spec.analysis === 'actions') return checkActions;
    if (spec.reported_by !== undefined)
        return async (_session, planned) => ({
            check: spec.name,
            scope: planned.scope.scope.path,
            status: 'skipped',
            note: `its findings come from ${spec.reported_by}`,
            files: 0,
            duration: 0,
            findings: [],
        });
    return (session, planned) => runToolCheck(session, planned);
}

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
    generatedDrift?: () => import('#cli/emit/drift.ts').DriftEntry[];
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
