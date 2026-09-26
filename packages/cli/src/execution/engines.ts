import { join } from 'node:path';
import { emitAll } from '#cli/generation/render.ts';
import { checkActions } from '#cli/checks/actions.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { MissingToolError } from '#cli/tools/errors.ts';
import type { CheckResult } from '#cli/checks/result.ts';
import type { Session } from '#cli/execution/session.ts';
import { valeFindings } from '#cli/checks/prose/vale.ts';
import { SkippedCheckError } from '#cli/checks/result.ts';
import type { PlannedCheck } from '#cli/execution/plan.ts';
import { checkSwiftlint } from '#cli/checks/swift/lint.ts';
import { resolveIntegrity } from '#cli/checks/dispatch.ts';
import { resolveNaming } from '#cli/checks/naming/engine.ts';
import { runToolCheck } from '#cli/execution/tool-runner.ts';
import { sourceBans } from '#cli/checks/prose/source-bans.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import type { Engine, EngineInput } from '#cli/checks/input.ts';
import { resolveStructure } from '#cli/checks/structure/engine.ts';
import { checkSecretHistory } from '#cli/checks/secrets/history.ts';
// Dispatch to the built-in engines by `engine =` in the manifest.
import { checkCommitMessages } from '#cli/checks/commit-messages.ts';
import { checkVerifiedSecrets } from '#cli/checks/secrets/verified.ts';
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';
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

// The engine of a check that runs its declared command.
function toolEngine(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    return runToolCheck(session, planned);
}

// Classify missing tools and unmet prerequisites separately from engine errors.
function failureOf(name: string, error: unknown): Pick<CheckResult, 'status' | 'note'> {
    if (error instanceof SkippedCheckError) return { status: 'skipped', note: error.message };
    if (error instanceof MissingToolError) return { status: 'missing', note: error.message };
    return { status: 'error', note: `the ${name} engine failed: ${(error as Error).message}` };
}

/**
 * Supply execution services and selected files without exposing the repository session.
 * @param session the open session
 * @param planned the planned check with its scope and files
 * @returns the engine input
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
        if (planned.spec.analysis === 'generated-drift')
            input.generatedDrift = () =>
                computeDrift(
                    session.root,
                    session.policyFiles.policy,
                    session.packageManager !== undefined,
                    emitAll(session.policyFiles.policy, session.repository, session.scopes, {
                        version: session.version,
                        packageManager: session.packageManager,
                    }),
                );
        if (planned.spec.analysis === 'suppressions')
            input.suppressions = suppressionComments(
                session.root,
                session.scopes,
                session.observations,
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
        if (checkedFiles?.some((path) => !allowedFiles.some((file) => file.path === path)) === true)
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
 * @returns the function that runs the check
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
        return (_session, planned) =>
            Promise.resolve({
                check: spec.name,
                scope: planned.scope.scope.path,
                status: 'skipped',
                note: `its findings come from ${spec.reported_by}`,
                files: 0,
                duration: 0,
                findings: [],
            });
    return toolEngine;
}
