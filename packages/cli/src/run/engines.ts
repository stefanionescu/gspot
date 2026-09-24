import { join } from 'node:path';
import { computeDrift } from '#cli/emit/drift.ts';
import { valeFindings } from '#cli/prose/vale.ts';
import { resolveNaming } from '#cli/naming/engine.ts';
import { sourceBans } from '#cli/prose/source-bans.ts';
import type { CheckResult } from '#cli/types/reports.ts';
import { resolveIntegrity } from '#cli/checks/dispatch.ts';
import { resolveStructure } from '#cli/structure/engine.ts';
// Dispatch to the built-in engines by `engine =` in the manifest.
import type { CheckSpec } from '#cli/types/configurations.ts';
import { MissingToolError } from '#cli/tools/missing-tool.ts';
import { SkippedCheckError } from '#cli/platform/skipped-check.ts';
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';
import type { EngineInput, Engine, Session, PlannedCheck } from '#cli/types/execution.ts';

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
 * @param engine the implementation selected during planning
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
 * Resolve a built-in implementation without executing its preparation or inspecting source files.
 * @param spec
 */
export function resolveEngine(spec: CheckSpec & { engine: NonNullable<CheckSpec['engine']> }): Engine {
    return engines[spec.engine](spec);
}
